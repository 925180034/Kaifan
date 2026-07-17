import time


class SlidingWindowRateLimiter:
    def __init__(self, limit, window_seconds, clock=time.monotonic):
        self.limit = int(limit)
        self.window_seconds = float(window_seconds)
        self.clock = clock
        self.requests = {}

    def allow(self, key):
        now = self.clock()
        earliest = now - self.window_seconds
        entries = [timestamp for timestamp in self.requests.get(key, []) if timestamp > earliest]
        if len(entries) >= self.limit:
            self.requests[key] = entries
            return False
        entries.append(now)
        self.requests[key] = entries
        return True
