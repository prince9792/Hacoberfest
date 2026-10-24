import unittest

from app.config import load_settings


class SettingsTests(unittest.TestCase):
    def test_loads_service_settings_and_parses_booleans(self):
        settings = load_settings(
            {
                "DATABASE_URL": "postgresql+psycopg://localhost/tooldoctor",
                "REDIS_URL": "redis://localhost:6379/0",
                "AUTH_REQUIRED": "false",
                "AUTH_COOKIE_SECURE": "true",
                "MONITOR_INTERVAL_SECONDS": "3600",
            }
        )

        self.assertEqual(
            settings["DATABASE_URL"], "postgresql+psycopg://localhost/tooldoctor"
        )
        self.assertEqual(settings["REDIS_URL"], "redis://localhost:6379/0")
        self.assertFalse(settings["AUTH_REQUIRED"])
        self.assertTrue(settings["AUTH_COOKIE_SECURE"])
        self.assertEqual(settings["MONITOR_INTERVAL_SECONDS"], 3600)

    def test_invalid_boolean_is_reported(self):
        with self.assertRaisesRegex(ValueError, "AUTH_REQUIRED must be a boolean"):
            load_settings({"AUTH_REQUIRED": "sometimes"})


if __name__ == "__main__":
    unittest.main()
