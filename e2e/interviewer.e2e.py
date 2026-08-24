import asyncio, json
from pathlib import Path
from playwright.async_api import async_playwright

S = Path("/tmp/browser/vmx/shots"); S.mkdir(parents=True, exist_ok=True)
BASE = "http://localhost:8080"

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True, args=[
            "--use-fake-ui-for-media-stream",
            "--use-fake-device-for-media-stream",
            "--autoplay-policy=no-user-gesture-required",
        ])
        ctx = await b.new_context(viewport={"width":1280,"height":1800},
                                  permissions=["camera","microphone"])
        page = await ctx.new_page()
        errs = []
        page.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: errs.append(f"pageerror: {e}"))
        for name, path in [("home","/"),("dash","/dashboard"),("intro","/interviewer"),
                           ("setup","/interviewer/setup"),("interview","/interviewer/interview")]:
            await page.goto(BASE+path, wait_until="domcontentloaded")
            await page.wait_for_timeout(2500)
            await page.screenshot(path=str(S/f"{name}.png"))
            print(name, path, "->", page.url)
        print(json.dumps(errs[:25], indent=1))
        await b.close()

asyncio.run(main())
