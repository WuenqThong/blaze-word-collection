"""Safety regression checks without importing or starting the application."""
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('sim_runner', Path(__file__).with_name('run.py'))
runner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runner)


class IsolationChecks(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix='blaze-simulator-guard-')
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name) / 'simulator'
        self.root.mkdir()
        self.directory = self.root / 'run-example'
        self.directory.mkdir()
        (self.directory / 'run.json').write_text(json.dumps(dict(run_id=self.directory.name, seed=42, synthetic=True)))
        self.env = dict(DATABASE_URL='sqlite:///' + (self.directory / 'simulator.db').as_posix(), ENVIRONMENT='test')
        self.root_patch = patch.object(runner, 'ROOT', self.root)
        self.root_patch.start()
        self.addCleanup(self.root_patch.stop)

    def test_reject_database_reuse_without_mutating_file(self):
        database = self.directory / 'simulator.db'
        database.write_bytes(b'existing QA content')
        with patch.dict(os.environ, self.env), self.assertRaisesRegex(RuntimeError, 'reuse'):
            runner.validate_run(self.directory, 42)
        self.assertEqual(database.read_bytes(), b'existing QA content')

    def test_reject_external_run_directory(self):
        with self.assertRaisesRegex(RuntimeError, 'immediate child'):
            runner.validate_run(self.root.parent, 42)

    def test_reject_wrong_database_environment(self):
        with patch.dict(os.environ, {**self.env, 'DATABASE_URL': 'sqlite:///real-qa.db'}):
            with self.assertRaisesRegex(RuntimeError, 'isolation mismatch'):
                runner.validate_run(self.directory, 42)
        self.assertFalse((self.directory / 'simulator.db').exists())

    def test_reject_wrong_marker_seed(self):
        with self.assertRaisesRegex(RuntimeError, 'marker'):
            runner.validate_run(self.directory, 43)

    def test_accept_only_fresh_marked_run(self):
        with patch.dict(os.environ, self.env):
            self.assertEqual(runner.validate_run(self.directory, 42), self.directory.resolve())
        self.assertFalse((self.directory / 'simulator.db').exists())

    def prepare_runner(self):
        content = runner.FIXTURES.read_bytes()
        extended = runner.FIXTURES.with_name('extended_fixtures.json').read_bytes()
        (self.directory / 'extended_fixtures.json').write_bytes(extended)
        (self.directory / 'fixtures.json').write_bytes(content)
        (self.directory / 'run.json').write_text(json.dumps(dict(
            run_id=self.directory.name, seed=42, synthetic=True, fixture_sha256=runner.digest(content),
            extended_fixture_sha256=runner.digest(extended))))
        return runner.Runner(self.directory, 42)

    def test_fixture_tampering_is_rejected(self):
        self.prepare_runner()
        (self.directory / 'fixtures.json').write_text('{}')
        with self.assertRaisesRegex(RuntimeError, 'checksum mismatch'):
            runner.Runner(self.directory, 42)

    def test_extended_fixture_tampering_is_rejected(self):
        self.prepare_runner()
        (self.directory / 'extended_fixtures.json').write_text('{}')
        with self.assertRaisesRegex(RuntimeError, 'Extended fixture checksum mismatch'):
            runner.Runner(self.directory, 42)

    def test_failed_assertion_is_preserved_and_not_marked_pass(self):
        instance = self.prepare_runner()
        instance.scenario('intentional_failure', 'Expected failure probe', 'test-only',
                          lambda: instance.check(False, 'expected result', 'wrong result'))
        report = json.loads((self.directory / 'report.json').read_text(encoding='utf-8'))
        self.assertEqual(report['status'], 'FAILED')
        self.assertEqual(report['failed'], 1)
        self.assertFalse(report['scenarios'][0]['steps'][0]['passed'])
        self.assertTrue((self.directory / 'intentional_failure-error.txt').exists())

    def complete_report(self):
        return dict(seed=42, status='PASSED', complete=True, passed=len(runner.expected_ids()), failed=0,
                    scenarios=[dict(id=sid, label=sid, mode='test-only', status='PASS',
                                    steps=[dict(passed=True)]) for sid in runner.expected_ids()])

    def test_complete_coverage_can_pass(self):
        runner.save(self.directory / 'report.json', self.complete_report())
        report, code = runner.finish_report(self.directory, 0)
        self.assertEqual((report['status'], code), ('PASSED', 0))

    def test_skipped_scenario_cannot_pass(self):
        report = self.complete_report()
        report['scenarios'].pop()
        runner.save(self.directory / 'report.json', report)
        self.assertEqual(runner.finish_report(self.directory, 0)[1], 1)

    def test_duplicate_scenario_cannot_pass(self):
        report = self.complete_report()
        report['scenarios'][-1] = report['scenarios'][0]
        runner.save(self.directory / 'report.json', report)
        self.assertEqual(runner.finish_report(self.directory, 0)[1], 1)

    def test_failed_step_cannot_hide_in_passed_scenario(self):
        report = self.complete_report()
        report['scenarios'][0]['steps'][0]['passed'] = False
        runner.save(self.directory / 'report.json', report)
        self.assertEqual(runner.finish_report(self.directory, 0)[1], 1)

    def test_worker_timeout_replaces_markdown_status(self):
        runner.save(self.directory / 'report.json', self.complete_report())
        report, code = runner.finish_report(self.directory, 1, 'Worker timeout')
        self.assertEqual((report['status'], code), ('FAILED', 1))
        markdown = (self.directory / 'report.md').read_text(encoding='utf-8')
        self.assertIn('**FAILED**', markdown)
        self.assertNotIn('**PASSED**', markdown)

    def test_missing_and_truncated_reports_fail_with_readable_output(self):
        for contents in (None, '{"scenarios":'):
            if contents is not None:
                (self.directory / 'report.json').write_text(contents)
            report, code = runner.finish_report(self.directory, 1)
            self.assertEqual((report['status'], code), ('FAILED', 1))
            self.assertTrue((self.directory / 'report.md').exists())

    def test_malformed_scenario_cannot_break_final_failure_report(self):
        report = self.complete_report()
        report['scenarios'] = [{'id': 'incomplete-row'}]
        runner.save(self.directory / 'report.json', report)
        final, code = runner.finish_report(self.directory, 1)
        self.assertEqual((final['status'], code), ('FAILED', 1))
        self.assertIn('**FAILED**', (self.directory / 'report.md').read_text(encoding='utf-8'))

    def test_changed_source_is_rejected(self):
        source = self.root / 'source.py'
        source.write_bytes(b'original')
        runner.save(self.directory / 'run.json', dict(source_hashes={'source.py': runner.digest(source.read_bytes())}))
        with patch.object(runner, 'REPOSITORY', self.root):
            runner.verify_sources(self.directory)
            source.write_bytes(b'changed')
            with self.assertRaisesRegex(RuntimeError, 'Source changed'):
                runner.verify_sources(self.directory)

    def test_redirected_root_is_rejected(self):
        with patch.object(runner.os.path, 'realpath', return_value=str(self.root.parent / 'different')):
            with self.assertRaisesRegex(RuntimeError, 'redirected'):
                runner.safe_root()


if __name__ == '__main__':
    unittest.main(verbosity=2)
