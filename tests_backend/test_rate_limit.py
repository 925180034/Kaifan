import unittest

from server.rate_limit import SlidingWindowRateLimiter


class SlidingWindowRateLimiterTests(unittest.TestCase):
    def test_rejects_requests_after_the_limit_until_the_window_expires(self):
        clock = [0]
        limiter = SlidingWindowRateLimiter(limit=4, window_seconds=60, clock=lambda: clock[0])

        self.assertTrue(limiter.allow("user-1"))
        self.assertTrue(limiter.allow("user-1"))
        self.assertTrue(limiter.allow("user-1"))
        self.assertTrue(limiter.allow("user-1"))
        self.assertFalse(limiter.allow("user-1"))

        clock[0] = 61
        self.assertTrue(limiter.allow("user-1"))
