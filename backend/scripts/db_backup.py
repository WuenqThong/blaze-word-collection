"""Create a consistent SQLite backup without modifying the source."""
import argparse
from scripts.db_sqlite import snapshot


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source')
    parser.add_argument('destination')
    args = parser.parse_args()
    print(snapshot(args.source, args.destination))


if __name__ == '__main__':
    main()
