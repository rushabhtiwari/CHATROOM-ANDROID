"""Who the demo may actually put a message on the wire to.

`may_transmit` is the one guard between a rehearsal and a real company being told its
non-existent consignment has shipped, so both halves are asserted: that an opted-in
domain is answered, and that everything outside the opt-in still is not.
"""

from __future__ import annotations

import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.write_service.po_pipeline import may_transmit  # noqa: E402


def env(**values):
    """Only the mail-recipient variables, so a real .env cannot decide a test."""
    base = {"DEMO_MAIL_REDIRECT": "", "DEMO_MAIL_ALLOWED": "", "DEMO_MAIL_ALLOWED_DOMAINS": ""}
    return patch.dict("os.environ", {**base, **values})


class TestReservedAndNamedRecipients(unittest.TestCase):
    """The rules that existed before the domain opt-in, unchanged."""

    def test_a_reserved_demo_domain_is_always_allowed(self):
        with env():
            self.assertTrue(may_transmit("purchase@meghdootauto.example")[0])

    def test_the_redirect_inbox_is_allowed(self):
        with env(DEMO_MAIL_REDIRECT="me@gmail.com"):
            self.assertTrue(may_transmit("me@gmail.com")[0])

    def test_a_named_address_is_allowed(self):
        with env(DEMO_MAIL_ALLOWED="colleague@theircompany.com"):
            self.assertTrue(may_transmit("colleague@theircompany.com")[0])

    def test_a_real_address_nobody_opted_in_is_refused(self):
        with env():
            allowed, reason = may_transmit("procurement@realcompany.com")
        self.assertFalse(allowed)
        self.assertIn("refused", reason)

    def test_the_refusal_names_the_domain_to_opt_in(self):
        with env():
            _, reason = may_transmit("someone@realcompany.com")
        self.assertIn("DEMO_MAIL_ALLOWED_DOMAINS=realcompany.com", reason)

    def test_an_empty_address_is_refused_rather_than_sent(self):
        with env():
            self.assertFalse(may_transmit("")[0])

    def test_something_that_is_not_an_address_is_refused(self):
        with env(DEMO_MAIL_ALLOWED_DOMAINS="gmail.com"):
            self.assertFalse(may_transmit("gmail.com")[0])


class TestDomainOptIn(unittest.TestCase):
    """`DEMO_MAIL_ALLOWED_DOMAINS` - the demo where anybody may send an order."""

    def test_anybody_on_an_opted_in_domain_is_answered(self):
        with env(DEMO_MAIL_ALLOWED_DOMAINS="gmail.com"):
            for address in ("someone@gmail.com", "a.buyer@gmail.com", "nobody-listed@gmail.com"):
                self.assertTrue(may_transmit(address)[0], address)

    def test_it_is_case_and_whitespace_insensitive(self):
        with env(DEMO_MAIL_ALLOWED_DOMAINS=" GMail.com , @outlook.com "):
            self.assertTrue(may_transmit("Someone@Gmail.COM")[0])
            self.assertTrue(may_transmit("buyer@outlook.com")[0])

    def test_semicolons_separate_too(self):
        with env(DEMO_MAIL_ALLOWED_DOMAINS="gmail.com;outlook.com"):
            self.assertTrue(may_transmit("buyer@outlook.com")[0])

    def test_opting_one_domain_in_does_not_open_the_rest(self):
        """The whole point of the guard: a real company is still refused."""
        with env(DEMO_MAIL_ALLOWED_DOMAINS="gmail.com"):
            allowed, reason = may_transmit("purchase@realcompany.com")
        self.assertFalse(allowed)
        self.assertIn("refused", reason)

    def test_a_subdomain_is_not_the_domain(self):
        """`gmail.com` must not silently mean `evil-gmail.com` or `mail.gmail.com`."""
        with env(DEMO_MAIL_ALLOWED_DOMAINS="gmail.com"):
            self.assertFalse(may_transmit("buyer@notgmail.com")[0])
            self.assertFalse(may_transmit("buyer@mail.gmail.com")[0])

    def test_nothing_is_allowed_by_default(self):
        """Blank means blank: opting a domain in is always a deliberate line in .env."""
        with env():
            self.assertFalse(may_transmit("someone@gmail.com")[0])


if __name__ == "__main__":
    unittest.main()
