"""Offline smoke check: isolation, installed ML libraries, CPU/CUDA backward."""
import argparse
import importlib.metadata
import json
import os
from pathlib import Path
import sys


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--lab-root', type=Path, default=Path('E:/blaze-voice-lab'))
    parser.add_argument('--require-cuda', action='store_true')
    args = parser.parse_args()
    repository = Path(__file__).resolve().parents[2]
    expected = repository / 'ml' / '.venv'
    if Path(sys.prefix).resolve() != expected.resolve() or sys.prefix == sys.base_prefix:
        raise RuntimeError('Run with ml/.venv/Scripts/python.exe')
    root = args.lab_root.resolve()
    if root == repository or repository in root.parents:
        raise RuntimeError('Lab data must be outside repository')
    for name in ('datasets', 'models', 'runs', 'cache', 'qa', 'browser-profile'):
        (root / name).mkdir(parents=True, exist_ok=True)
    os.environ['HF_HOME'] = str(root / 'cache' / 'huggingface')
    os.environ['TORCH_HOME'] = str(root / 'cache' / 'torch')
    os.environ['HF_HUB_OFFLINE'] = '1'
    import torch
    import transformers
    import datasets
    import peft
    import accelerate

    def backward(device):
        torch.manual_seed(42)
        x = torch.randn(8, 4, device=device)
        layer = torch.nn.Linear(4, 2).to(device)
        optimizer = torch.optim.SGD(layer.parameters(), lr=0.01)
        before = layer.weight.detach().clone()
        loss = layer(x).square().mean()
        loss.backward()
        optimizer.step()
        if not torch.isfinite(loss) or torch.equal(before, layer.weight.detach()):
            raise RuntimeError(f'Backward/update failed on {device}')
        return {'device': device, 'loss': loss.item(), 'weights_updated': True}

    cuda = torch.cuda.is_available()
    if args.require_cuda and not cuda:
        raise RuntimeError('CUDA requested but unavailable')
    results = [backward('cpu')]
    if cuda:
        results.append(backward('cuda'))
    report = {
        'status': 'passed', 'python': sys.version, 'executable': sys.executable,
        'base_prefix': sys.base_prefix, 'lab_root': str(root),
        'packages': {name: importlib.metadata.version(name) for name in (
            'torch', 'transformers', 'datasets', 'peft', 'accelerate', 'sentencepiece', 'safetensors')},
        'cuda_available': cuda, 'torch_cuda': torch.version.cuda,
        'gpu': torch.cuda.get_device_name(0) if cuda else None,
        'gpu_total_bytes': torch.cuda.get_device_properties(0).total_memory if cuda else None,
        'smoke_checks': results,
        'scope': 'Environment smoke check only; no language model trained or downloaded.',
    }
    target = root / 'runs' / 'environment-check.json'
    target.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
