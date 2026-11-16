"""
Saves the email (SMTP) settings into the private env file. Values come from environment variables so the password never
appears on a command line:  ENV_FILE, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM, APP_BASE_URL, SMTP_STARTTLS
Replaces any older SMTP_* / APP_BASE_URL lines and keeps the file private (mode 600). Prints nothing secret.
"""
import os
import re
import shlex
import stat
import sys

KEYS = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD", "SMTP_FROM", "SMTP_STARTTLS", "APP_BASE_URL"]


def main():
    path = os.environ.get("ENV_FILE")
    if not path:
        sys.exit("ENV_FILE is not set")
    host = os.environ.get("SMTP_HOST", "").strip()
    frm = os.environ.get("SMTP_FROM", "").strip()
    if not host or not frm:
        sys.exit("SMTP_HOST and SMTP_FROM are required.")
    if re.search(r"[\r\n]", "".join(os.environ.get(k, "") for k in KEYS)):
        sys.exit("Values must be one line.")
    lines = []
    if os.path.exists(path):
        lines = [l for l in open(path, encoding="utf-8").read().splitlines() if not re.match(r"^(" + "|".join(KEYS) + r")=", l)]
    new = {k: os.environ.get(k, "").strip() for k in KEYS}
    new["SMTP_PORT"] = new["SMTP_PORT"] or "587"
    new["SMTP_STARTTLS"] = new["SMTP_STARTTLS"] or "true"
    for k in KEYS:
        if new[k] != "":
            lines.append(f"{k}={shlex.quote(new[k])}")   # quoted: the file is loaded by bash, so spaces and symbols in a password are safe
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines) + "\n")
    os.chmod(path, stat.S_IRUSR | stat.S_IWUSR)
    print(f"Saved email settings for {host} (password not shown).")


if __name__ == "__main__":
    main()
