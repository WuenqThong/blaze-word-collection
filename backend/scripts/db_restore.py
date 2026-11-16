"""Restore a checked SQLite backup to a NEW path; never overwrite a live DB."""
from scripts.db_backup import main

if __name__ == '__main__':
    main()
