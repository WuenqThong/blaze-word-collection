"""One staff role; accept the old value while existing deployments migrate."""
STAFF_ROLES = ('reviewer', 'admin')


def canonical_role(role):
    return 'reviewer' if role in STAFF_ROLES else role
