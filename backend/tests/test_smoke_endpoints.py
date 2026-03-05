import unittest
import asyncio
from main import health_check, root


class SmokeEndpointTests(unittest.TestCase):
    def test_health_endpoint(self):
        result = asyncio.run(health_check())
        self.assertEqual(result, {"status": "healthy"})

    def test_root_endpoint(self):
        result = asyncio.run(root())
        self.assertIn("message", result)


if __name__ == "__main__":
    unittest.main()
