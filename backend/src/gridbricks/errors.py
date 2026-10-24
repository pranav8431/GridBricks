"""Application-level errors that map to HTTP problem responses."""


class ScopeError(ValueError):
    """A request falls outside the dates the pilot covers."""
