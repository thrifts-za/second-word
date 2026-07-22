"""Interaction-level check of the deployed Second Word product page.

Run with:
  uv run --with selenium python scripts/public-browser-e2e.py

This intentionally performs three live analyses and one live rewrite.
"""

from pathlib import Path
from time import monotonic

from selenium import webdriver
from selenium.common.exceptions import TimeoutException
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait


PUBLIC_URL = "https://second-word.pages.dev"
CHROME_BINARY = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
OUTPUT = Path(__file__).resolve().parents[1] / "output" / "e2e"


def wait_until(driver, predicate, label, seconds=38):
    try:
        return WebDriverWait(driver, seconds, poll_frequency=0.25).until(predicate)
    except TimeoutException as exc:
        raise AssertionError(f"Timed out waiting for {label}") from exc


def badge_class(driver):
    return driver.execute_script(
        "return document.querySelector('second-word-badge')?.shadowRoot?.querySelector('.badge')?.className || ''"
    )


def badge_text(driver):
    return driver.execute_script(
        "return document.querySelector('second-word-badge')?.shadowRoot?.textContent || ''"
    )


def panel_text(driver):
    return driver.execute_script(
        "return document.querySelector('[data-second-word]')?.shadowRoot?.textContent || ''"
    )


def click_badge(driver):
    clicked = driver.execute_script(
        """
        const button = document.querySelector('second-word-badge')?.shadowRoot?.querySelector('[role="button"]');
        if (!button) return false;
        button.click();
        return true;
        """
    )
    assert clicked, "Second Word badge was not clickable"


def close_panel(driver):
    driver.execute_script(
        "document.querySelector('[data-second-word]')?.shadowRoot?.querySelector('.panel__dismiss')?.click()"
    )
    wait_until(driver, lambda d: panel_text(d) == "", "panel to close")


def click_shadow_button(driver, text):
    clicked = driver.execute_script(
        """
        const wanted = arguments[0];
        const root = document.querySelector('[data-second-word]')?.shadowRoot;
        const button = [...(root?.querySelectorAll('button') || [])].find((node) => node.textContent.trim() === wanted);
        if (!button) return false;
        button.click();
        return true;
        """,
        text,
    )
    assert clicked, f"Panel button not found: {text}"


def click_named(driver, elements, text):
    matches = [element for element in elements if element.text.strip() == text]
    assert len(matches) == 1, f"Expected one {text!r} control, found {len(matches)}"
    driver.execute_script("arguments[0].click()", matches[0])


def click_element(driver, element):
    driver.execute_script("arguments[0].click()", element)


options = webdriver.ChromeOptions()
if Path(CHROME_BINARY).exists():
    options.binary_location = CHROME_BINARY
options.add_argument("--headless=new")
options.add_argument("--window-size=1440,1100")
options.add_argument("--disable-gpu")
options.add_argument("--no-first-run")
options.add_argument("--no-default-browser-check")

OUTPUT.mkdir(parents=True, exist_ok=True)
started = monotonic()

with webdriver.Chrome(options=options) as driver:
    driver.get(PUBLIC_URL)
    wait_until(
        driver,
        lambda d: "connected to the live second word worker" in d.find_element(By.ID, "live-status").text.lower(),
        "live Worker",
    )
    wait_until(driver, lambda d: d.find_element(By.ID, "provider").text == "Gloo AI Studio", "Gloo provider label")

    # Presence: empty composer, no draft analysis, verified Verse of the Day on click.
    wait_until(driver, lambda d: "presence" in badge_class(d), "Presence badge")
    click_badge(driver)
    presence = wait_until(driver, lambda d: panel_text(d) if "Verse of the Day" in panel_text(d) else False, "Verse of the Day panel")
    assert "References" in presence
    assert "Return to my message" in presence
    close_panel(driver)

    # Guard: automatic noticing, exact moment card, and optional rewrite.
    click_named(driver, driver.find_elements(By.CSS_SELECTOR, ".scenario-tab"), "The rejection")
    click_element(driver, driver.find_element(By.ID, "fill"))
    wait_until(driver, lambda d: "guard" in badge_class(d), "Guard badge")
    assert "A word for this" in badge_text(driver)
    click_badge(driver)
    guard = wait_until(driver, lambda d: panel_text(d) if "Show alternatives" in panel_text(d) else False, "Guard card")
    assert "References" in guard
    click_shadow_button(driver, "Show alternatives")
    alternatives = wait_until(driver, lambda d: panel_text(d) if "Replace my draft" in panel_text(d) else False, "rewrite alternatives")
    assert "Copy" in alternatives
    close_panel(driver)

    # Guide: good moment, gold treatment, no interrogation and no rewrite.
    slack = driver.find_element(By.CSS_SELECTOR, '[aria-label="Show Second Word in Slack"]')
    click_element(driver, slack)
    click_named(driver, driver.find_elements(By.CSS_SELECTOR, ".scenario-tab"), "A willing yes")
    click_element(driver, driver.find_element(By.ID, "fill"))
    wait_until(driver, lambda d: "guide" in badge_class(d), "Guide badge")
    click_badge(driver)
    guide = wait_until(driver, lambda d: panel_text(d) if "A word for this good moment" in panel_text(d) else False, "Guide card")
    assert "Show alternatives" not in guide
    assert "?" not in guide
    close_panel(driver)

    # Silence: neutral logistics return to Presence with no corrective invitation.
    click_named(driver, driver.find_elements(By.CSS_SELECTOR, ".scenario-tab"), "Knows when to stay quiet")
    click_element(driver, driver.find_element(By.ID, "fill"))
    wait_until(driver, lambda d: "presence" in badge_class(d), "deliberate Silence")
    assert panel_text(driver) == ""

    driver.save_screenshot(str(OUTPUT / "public-demo-final.png"))
    print(f"PASS public browser E2E in {monotonic() - started:.1f}s")
    print("PASS Presence -> Guard -> Rewrite -> Guide -> Silence")
    print("PASS live page names Gloo AI Studio")
