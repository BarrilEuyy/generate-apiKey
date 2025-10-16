// fill_form_all.js
const puppeteerExtra = require("puppeteer-extra");
const Stealth = require("puppeteer-extra-plugin-stealth");
const fs = require("fs");
const path = require("path");

puppeteerExtra.use(Stealth());

// file untuk menyimpan password (append)
const PASSWORD_FILE = path.join(__dirname, "passwords.txt");

function randChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randName() {
  const first = randChoice([
    "John",
    "Jane",
    "Alex",
    "Nina",
    "Budi",
    "Rina",
    "David",
    "Ayu",
    "Arief",
    "Sari",
  ]);
  const last = randChoice([
    "Smith",
    "Doe",
    "Pratama",
    "Lestari",
    "Williams",
    "Santoso",
    "Nugroho",
    "Putri",
  ]);
  return { first, last };
}
function randEmail(first, last) {
  const domains = ["gmail.com", "outlook.com", "yahoo.com"];
  return `${first.toLowerCase()}.${last.toLowerCase()}@${randChoice(domains)}`;
}
function randCompany() {
  return randChoice([
    "Acme Corp",
    "Nusantara Teknologi",
    "PT Sukses Jaya",
    "Bright Ltd",
  ]);
}

function genPassword(len = 14) {
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lower = "abcdefghijklmnopqrstuvwxyz";
  const digits = "0123456789";
  const symbols = "!@#$%^&*()-_=+[]{};:,.<>?";
  const all = upper + lower + digits + symbols;
  const out = [
    randChoice(upper),
    randChoice(lower),
    randChoice(digits),
    randChoice(symbols),
  ];
  while (out.length < len)
    out.push(all[Math.floor(Math.random() * all.length)]);
  // shuffle
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out.join("");
}
function appendPasswordRecord({ email, password }) {
  const ts = new Date().toISOString();
  const entry = [
    "---",
    `timestamp: ${ts}`,
    `email: ${email}`,
    `password: ${password}`,
    "---",
    "",
  ].join("\n");
  fs.appendFileSync(PASSWORD_FILE, entry, { encoding: "utf8" });
  console.log(`Password appended to ${PASSWORD_FILE}`);
}

// escape bracket names for CSS selectors like name="user[first_name]"
function nameToSelector(name, tag = "input") {
  const escaped = name.replace(/\[/g, "\\[").replace(/\]/g, "\\]");
  return `${tag}[name="${escaped}"]`;
}

(async () => {
  const TARGET_URL = "https://www.cloudskillsboost.google/users/sign_up"; // Ganti dengan URL form-mu

  const browser = await puppeteerExtra.launch({
    headless: false,
    defaultViewport: { width: 1280, height: 720 },
  });
  const page = await browser.newPage();

  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0"
  );
  await page.goto(TARGET_URL, { waitUntil: "networkidle2", timeout: 60000 });

  // generate data
  const { first, last } = randName();
  const email = randEmail(first, last);
  const company = randCompany();
  const password = genPassword(14);

  // Helper: set value via evaluate (works even if direct selectors tricky)
  async function setInputValueByName(name, value) {
    const selector = nameToSelector(name, "input");
    try {
      await page.waitForSelector(selector, { visible: true, timeout: 3000 });
      // prefer typing (fires events)
      await page.click(selector, { clickCount: 3 });
      await page.type(selector, value, { delay: 40 });
      return true;
    } catch (e) {
      // fallback to evaluate set and dispatch input/change events
      try {
        await page.evaluate(
          (name, val) => {
            const el = document.getElementsByName(name)[0];
            if (!el) return false;
            el.focus();
            el.value = val;
            el.dispatchEvent(new Event("input", { bubbles: true }));
            el.dispatchEvent(new Event("change", { bubbles: true }));
            return true;
          },
          name,
          value
        );
        return true;
      } catch (e2) {
        console.warn("Could not set", name, e2.message || e2);
        return false;
      }
    }
  }

  // Fill textual fields
  await setInputValueByName("user[first_name]", first);
  await setInputValueByName("user[last_name]", last);
  await setInputValueByName("user[email]", email);
  await setInputValueByName("user[company_name]", company);

  // Password fields (two inputs). Try direct name first, else find input[type=password]
  const passSet = await setInputValueByName("user[password]", password);
  let confirmSet = await setInputValueByName(
    "user[password_confirmation]",
    password
  );

  if (!confirmSet) {
    // find second password input on page and fill it
    const passHandles = await page.$$('input[type="password"]');
    if (passHandles.length >= 2) {
      try {
        await passHandles[1].click({ clickCount: 3 });
        await passHandles[1].type(password, { delay: 40 });
        confirmSet = true;
      } catch (e) {
        /* ignore */
      }
    }
  }

  // DOB selects: try selecting by name, escaped
  async function selectByName(name, value) {
    const sel = nameToSelector(name, "select");
    try {
      await page.waitForSelector(sel, { visible: true, timeout: 2000 });
      await page.select(sel, String(value));
      return true;
    } catch (e) {
      // fallback: set via evaluate
      try {
        await page.evaluate(
          (name, val) => {
            const s = document.getElementsByName(name)[0];
            if (!s) return false;
            s.value = String(val);
            s.dispatchEvent(new Event("change", { bubbles: true }));
            return true;
          },
          name,
          value
        );
        return true;
      } catch (e2) {
        return false;
      }
    }
  }

  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const birth = {
    month: randChoice(months),
    day: String(Math.floor(Math.random() * 28) + 1),
    year: String(1975 + Math.floor(Math.random() * 30)),
  };

  // Tunggu dulu agar DOM siap
  await new Promise((resolve) => setTimeout(resolve, 2000));
  // bisa diganti pakai waitForSelector jika ingin lebih presisi

  await page.evaluate(
    ({ birth }) => {
      // Month (select)
      const monthSelect = document.querySelector('select[name="dob_month"]');
      if (monthSelect) {
        monthSelect.value = birth.month;
        monthSelect.dispatchEvent(new Event("input", { bubbles: true }));
        monthSelect.dispatchEvent(new Event("change", { bubbles: true }));
      }

      // Day (input number)
      const dayInputs = document.getElementsByName("dob_day");
      if (dayInputs.length > 0) {
        const dayInput = dayInputs[0];
        dayInput.focus();
        dayInput.value = birth.day;
        dayInput.dispatchEvent(new Event("input", { bubbles: true }));
        dayInput.dispatchEvent(new Event("change", { bubbles: true }));
      }

      // Year (input number)
      const yearInputs = document.getElementsByName("dob_year");
      if (yearInputs.length > 0) {
        const yearInput = yearInputs[0];
        yearInput.focus();
        yearInput.value = birth.year;
        yearInput.dispatchEvent(new Event("input", { bubbles: true }));
        yearInput.dispatchEvent(new Event("change", { bubbles: true }));
      }
    },
    { birth }
  );

  console.log("DOB berhasil diisi:", birth);

  // await page.waitForSelector("div.g-recaptcha");
  // console.log("Elemen reCaptcha ditemukan.");
  // await page.click("div.g-recaptcha");

  // Ambil semua frame di halaman
  const frames = page.frames();

  for (const currentFrame of frames) {
    const name = await currentFrame.evaluate(() => {
      const captcha = document.getElementsByClassName(
        "rc-anchor-center-item rc-anchor-checkbox-label"
      )[0];
      if (captcha) {
        captcha.click();
      }
    });
  }

  console.log("berhasil");

  await new Promise((r) => setTimeout(r, 3000));

  // Save password record
  appendPasswordRecord({ email, password });

  console.log(
    "Form fields filled. Check browser. Password saved to",
    PASSWORD_FILE
  );

  // leave browser open for manual inspection (remove if you want auto close)
  // await browser.close();
})();
