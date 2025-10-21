// fill_form_all.js
const puppeteerExtra = require("puppeteer-extra");
const Stealth = require("puppeteer-extra-plugin-stealth");
const fs = require("fs");
const path = require("path");
const https = require("https");

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
    // args: [
    //   "--no-sandbox",
    //   "--disable-setuid-sandbox",
    //   "--proxy-server=45.3.51.84:3129", // ganti host:port kamu
    // ],
  });
  const page = await browser.newPage();

  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0"
  );
  await page.goto("https://proxyium.com/", {
    waitUntil: "networkidle2",
    timeout: 60000,
  });

  const framesw = page.frames();
  let inputFramew = null;

  for (const frame of framesw) {
    const hasInput = await frame.$('input[name="url"]');
    if (hasInput) {
      inputFramew = frame;
      break;
    }
  }

  if (!inputFramew) {
    throw new Error(
      "❌ Tidak menemukan input[name='url'] di halaman Proxyium!"
    );
  }

  console.log("✅ Input ditemukan di frame:", inputFramew.url());

  // Klik & isi value secara natural (agar event React/Angular terpanggil)
  const inputHandlew = await inputFramew.$('input[name="url"]');
  await inputHandlew.click({ clickCount: 3 });
  await inputHandlew.type(TARGET_URL, { delay: 80 });

  // Verifikasi dari sisi browser
  const valuew = await inputFramew.$eval('input[name="url"]', (el) => el.value);
  console.log("📥 Value setelah diketik:", valuew);

  if (!valuew || !valuew.includes("www.cloudskillsboost.google")) {
    throw new Error(
      "❌ Value input tidak berubah! (kemungkinan pakai shadow DOM)"
    );
  }

  // Klik tombol GO
  const buttonw = await inputFramew.$("button#unique-btn-blue");
  if (buttonw) {
    await buttonw.click();
    console.log("🚀 Tombol GO diklik, tunggu halaman terbuka...");
  } else {
    console.log("❌ Tombol GO tidak ditemukan di frame");
  }

  console.log("⏳ Menunggu 'Proxy is launching...' benar-benar selesai...");

  await page.waitForFunction(
    () => {
      const el = document.querySelector("p#loading-text");
      // Tunggu sampai elemen hilang atau teks-nya berubah dari "Proxy is launching"
      return !el || !/proxy is launching/i.test(el.innerText);
    },
    {
      timeout: 120000,
      polling: 500,
    }
  );

  await new Promise((r) => setTimeout(r, 10000));

  // generate data
  const { first, last } = randName();

  const company = randCompany();
  const password = genPassword(14);

  console.log("📬 Membuka temp-mail.org untuk ambil email...");
  const tempMailPage = await browser.newPage();
  await tempMailPage.goto("https://temp-mail.io/en", {
    waitUntil: "networkidle2",
    timeout: 60000,
  });

  // tunggu sampai email benar-benar termuat di halaman
  await tempMailPage.waitForFunction(
    () => {
      const el = document.querySelector("#email");
      return el.value;
    },
    { timeout: 30000 }
  );

  // ambil email address dari atribut yang benar
  const email = await tempMailPage.$eval("#email", (el) => el.value);

  console.log("✅ Email didapat dari temp-mail.org:", email);

  const firefox = await browser.newPage();
  await firefox.goto("https://proxyium.com/", {
    waitUntil: "networkidle2",
    timeout: 60000,
  });

  await firefox.bringToFront();
  const targetUrl = "https://relay.firefox.com/";

  const framesq = firefox.frames();
  let inputFrame = null;

  for (const frame of framesq) {
    const hasInput = await frame.$('input[name="url"]');
    if (hasInput) {
      inputFrame = frame;
      break;
    }
  }

  if (!inputFrame) {
    throw new Error(
      "❌ Tidak menemukan input[name='url'] di halaman Proxyium!"
    );
  }

  console.log("✅ Input ditemukan di frame:", inputFrame.url());

  // Klik & isi value secara natural (agar event React/Angular terpanggil)
  const inputHandle = await inputFrame.$('input[name="url"]');
  await inputHandle.click({ clickCount: 3 });
  await inputHandle.type(targetUrl, { delay: 80 });

  // Verifikasi dari sisi browser
  const value = await inputFrame.$eval('input[name="url"]', (el) => el.value);
  console.log("📥 Value setelah diketik:", value);

  if (!value || !value.includes("relay.firefox.com")) {
    throw new Error(
      "❌ Value input tidak berubah! (kemungkinan pakai shadow DOM)"
    );
  }

  // Klik tombol GO
  const button = await inputFrame.$("button#unique-btn-blue");
  if (button) {
    await button.click();
    console.log("🚀 Tombol GO diklik, tunggu halaman terbuka...");
  } else {
    console.log("❌ Tombol GO tidak ditemukan di frame");
  }

  console.log("⏳ Menunggu 'Proxy is launching...' benar-benar selesai...");

  await firefox.waitForFunction(
    () => {
      const el = document.querySelector("p#loading-text");
      // Tunggu sampai elemen hilang atau teks-nya berubah dari "Proxy is launching"
      return !el || !/proxy is launching/i.test(el.innerText);
    },
    {
      timeout: 120000,
      polling: 500,
    }
  );

  await new Promise((r) => setTimeout(r, 10000));

  console.log("✅ Animasi selesai, halaman siap dilanjutkan!");

  // Klik tombol Sign In / Sign Up
  await firefox.evaluate(() => {
    const btn = [...document.querySelectorAll("a, button")].find((b) =>
      /sign in|sign up/i.test(b.textContent)
    );
    if (btn) {
      btn.scrollIntoView({ behavior: "smooth", block: "center" });
      btn.click();
    } else {
      throw new Error("Tombol sign up tidak ditemukan di halaman");
    }
  });

  // Tunggu halaman login muncul
  await firefox.waitForSelector('input[name="email"]', { visible: true });

  await firefox.evaluate(
    (name, val) => {
      const el = document.getElementsByName(name)[0];
      if (!el) return false;
      el.focus();
      el.value = val;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    },
    "email",
    email
  );

  await firefox.waitForSelector("button.cta-primary.cta-xl", {
    visible: true,
    timeout: 10000,
  });

  await firefox.evaluate(() => {
    const btn = document.querySelector("button.cta-primary.cta-xl");
    if (btn) {
      btn.scrollIntoView({ behavior: "smooth", block: "center" });
      btn.removeAttribute("disabled"); // just in case
      btn.click();
    } else {
      throw new Error(
        "❌ Tombol dengan class 'cta-primary cta-xl' tidak ditemukan!"
      );
    }
  });

  console.log("✅ Tombol dengan class 'cta-primary cta-xl' berhasil diklik!");

  // Tunggu sampai input password muncul
  await firefox.waitForSelector('input[type="password"]', {
    visible: true,
    timeout: 10000,
  });

  // Ketik password-nya
  const passwordValue = genPassword(8); // atau bisa ambil dari variabel kamu sebelumnya
  await firefox.type('input[type="password"]', passwordValue, { delay: 50 });

  // Simpan ke variabel (misal nanti mau dipakai buat login atau disimpan di file)
  const relayPassword = passwordValue;

  console.log("✅ Password berhasil diisi:", relayPassword);

  await firefox.waitForSelector(
    "button.cta-primary.cta-xl.cta-primary.cta-xl",
    {
      visible: true,
      timeout: 10000,
    }
  );

  await new Promise((r) => setTimeout(r, 3000));

  await firefox.evaluate(() => {
    const btn = document.querySelector(
      "button.cta-primary.cta-xl.cta-primary.cta-xl"
    );
    if (btn) {
      btn.scrollIntoView({ behavior: "smooth", block: "center" });
      btn.removeAttribute("disabled"); // just in case
      btn.click();
    } else {
      throw new Error(
        "❌ Tombol dengan class 'cta-primary cta-xl' tidak ditemukan!"
      );
    }
  });

  tempMailPage.bringToFront();

  await tempMailPage.waitForSelector(
    "ul.email-list.grow.overflow-x-hidden.absolute.w-full.min-h-full",
    {
      visible: true,
      timeout: 20000,
    }
  );

  console.log("👀 Mengamati perubahan pada daftar email...");

  const otp = await tempMailPage.evaluate(() => {
    return new Promise((resolve) => {
      const ul = document.querySelector(
        "ul.email-list.grow.overflow-x-hidden.absolute.w-full.min-h-full"
      );
      if (!ul) {
        resolve(null);
        return;
      }

      // deteksi ketika <li> baru ditambahkan
      const observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
          for (const node of m.addedNodes) {
            if (node.tagName === "LI") {
              observer.disconnect();
              resolve(node.innerText || "📩 otp baru masuk (tanpa teks)");
              return;
            }
          }
        }
      });

      observer.observe(ul, { childList: true });
    });
  });

  if (otp) {
    console.log("✅ otp baru terdeteksi:", otp);
  } else {
    console.log("⚠️ Tidak ada otp baru yang muncul dalam waktu tunggu.");
  }

  // Ambil OTP (angka 6 digit)
  const otpMatch = otp.match(/\b(\d{6})\b/);

  let verificationCode = null;

  if (otpMatch) {
    verificationCode = otpMatch[1];
    console.log("✅ Verification code ditemukan:", verificationCode);
  } else {
    console.log("❌ Tidak ditemukan kode verifikasi di pesan.");
  }

  // verificationCode harus sudah ter-definisi (mis. "709998")
  if (!verificationCode)
    throw new Error("verificationCode belum didefinisikan!");

  try {
    // pastikan tab firefox aktif
    await firefox.bringToFront();

    // 1) Tunggu input code tersedia
    await firefox.waitForSelector('input[name="code"]', {
      visible: true,
      timeout: 15000,
    });

    // 2) Isi kode (bersih-bersihkan dulu isi lama)
    const codeHandle = await firefox.$('input[name="code"]');
    await codeHandle.click({ clickCount: 3 });
    await codeHandle.press("Backspace");
    await codeHandle.type(String(verificationCode), { delay: 60 });

    console.log("✅ OTP terisi:", verificationCode);

    // beri waktu kecil supaya event input/change ter-trigger di halaman
    await new Promise((r) => setTimeout(r, 1000));

    // 3) Cari tombol di page utama dulu
    let btn = await firefox.$("button.cta-primary.cta-xl");

    // 4) Kalau nggak ditemukan di page utama, cari di semua frame
    if (!btn) {
      for (const f of firefox.frames()) {
        try {
          const handle = await f.$("button.cta-primary.cta-xl");
          if (handle) {
            // bawa fokus ke page lalu operate di frame
            await firefox.bringToFront();
            // Klik via evaluate di context frame
            await f.evaluate((sel) => {
              const b = document.querySelector(sel);
              if (b) {
                b.scrollIntoView({ behavior: "smooth", block: "center" });
                b.removeAttribute("disabled");
                b.click();
              }
            }, "button.cta-primary.cta-xl");
            console.log("✅ Tombol klik di dalam frame.");
            return;
          }
        } catch (e) {
          // frame bisa detached, skip
        }
      }
    } else {
      // 5) Klik tombol di page utama (pakai evaluate agar klik native)
      await firefox.evaluate(() => {
        const sel = "button.cta-primary.cta-xl";
        const b = document.querySelector(sel);
        if (b) {
          b.scrollIntoView({ behavior: "smooth", block: "center" });
          b.removeAttribute("disabled");
          b.focus();
          b.click();
        } else {
          throw new Error("Tombol tidak ditemukan saat evaluate");
        }
      });
      console.log("✅ Tombol klik di page utama.");
    }

    // 6) (opsional) tunggu navigasi / konfirmasi sukses
    try {
      await firefox.waitForNavigation({
        waitUntil: "networkidle2",
        timeout: 15000,
      });
      console.log("🎉 Navigasi/submit selesai.");
    } catch {
      // jika tidak ada navigasi, page mungkin update via XHR — itu juga ok
      console.log(
        "ℹ️ Tidak ada navigasi; kemungkinan submit terjadi via AJAX."
      );
    }
  } catch (err) {
    console.error("❌ Gagal isi code / klik tombol:", err.message);
    // debug: screenshot
    try {
      await firefox.screenshot({ path: "debug-otp-fail.png", fullPage: true });
    } catch {}
    throw err;
  }

  await new Promise((r) => setTimeout(r, 4000));

  await firefox.waitForFunction(
    () => {
      return [...document.querySelectorAll("button")].some((btn) =>
        btn.textContent.trim().toLowerCase().includes("generate new mask")
      );
    },
    { timeout: 30000 }
  );

  await firefox.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find((b) =>
      b.textContent.trim().toLowerCase().includes("generate new mask")
    );
    if (btn) {
      btn.scrollIntoView({ behavior: "smooth", block: "center" });
      btn.removeAttribute("disabled"); // just in case
      btn.click();
      return true;
    } else {
      throw new Error(
        "❌ Tombol dengan teks 'Generate new mask' tidak ditemukan!"
      );
    }
  });

  console.log("✅ Tombol 'Generate new mask' berhasil diklik!");

  await new Promise((r) => setTimeout(r, 4000));

  const finalEmail = await firefox.evaluate(() => {
    const button = document.querySelector('button[title="Click to copy"] samp');
    if (!button)
      throw new Error(
        "❌ Elemen <samp> di dalam tombol 'Click to copy' tidak ditemukan!"
      );
    return button.textContent.trim();
  });

  console.log("📋 Text yang disalin:", finalEmail);

  await page.bringToFront();

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
  await setInputValueByName("user[email]", finalEmail);
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

  for (const frame of frames) {
    // Klik checkbox reCAPTCHA
    const clicked = await frame.evaluate(() => {
      const checkbox = document.querySelector(
        ".rc-anchor-center-item.rc-anchor-checkbox-label"
      );
      if (checkbox) {
        checkbox.click();
        return true;
      }
      return false;
    });

    if (clicked) {
      console.log("✅ Checkbox diklik, tunggu 2 detik...");
      await new Promise((r) => setTimeout(r, 2000));

      function findFrameByUrl(frame, keyword) {
        if (frame.url().includes(keyword)) return frame;
        for (const child of frame.childFrames()) {
          const found = findFrameByUrl(child, keyword);
          if (found) return found;
        }
        return null;
      }

      // 🕐 Tunggu frame muncul dengan timeout
      async function waitForFrame(page, keyword, timeout = 15000) {
        const start = Date.now();
        let frame = null;

        while (!frame && Date.now() - start < timeout) {
          frame = findFrameByUrl(page.mainFrame(), keyword);
          if (frame) break;
          await new Promise((r) => setTimeout(r, 500));
        }

        return frame;
      }

      // 🚀 Penggunaan
      const finalAudioFrame = await waitForFrame(page, "bframe", 20000);

      if (finalAudioFrame) {
        try {
          try {
            console.log("🔎 Cari tombol audio di frame...");
            await finalAudioFrame.waitForSelector("#recaptcha-audio-button", {
              visible: true,
              timeout: 10000,
            });

            // ✅ Ambil posisi tombol audio
            const btn = await finalAudioFrame.$("#recaptcha-audio-button");
            const box = await btn.boundingBox();

            if (!box) {
              console.log(
                "❌ boundingBox tidak ditemukan, tombol tidak terlihat."
              );
              fs.writeFileSync(
                "debug-bframe.html",
                await finalAudioFrame.content()
              );
              return;
            }

            // 🖱️ Klik dengan koordinat absolut (lebih efektif di Proxyium)
            const x = box.x + box.width / 2;
            const y = box.y + box.height / 2;
            await page.bringToFront();
            await page.mouse.move(x, y, { steps: 10 });
            await page.waitForTimeout(100 + Math.random() * 100);
            await page.mouse.click(x, y, { delay: 150 });

            console.log("🎧 Tombol audio diklik (pakai mouse.click).");

            // Tunggu frame audio challenge muncul
            const audioChallengeFrame = await waitForFrame(
              page,
              "audio",
              10000
            );
            if (!audioChallengeFrame) {
              console.log(
                "❌ Frame audio challenge tidak muncul setelah klik."
              );
              fs.writeFileSync("debug-after-click.html", await page.content());
              return;
            }

            console.log(
              "✅ Frame audio challenge aktif:",
              audioChallengeFrame.url()
            );

            // Tunggu link download muncul
            await audioChallengeFrame.waitForSelector(
              ".rc-audiochallenge-tdownload-link",
              {
                visible: true,
                timeout: 10000,
              }
            );

            const href = await audioChallengeFrame.$eval(
              ".rc-audiochallenge-tdownload-link",
              (el) => el.getAttribute("href")
            );

            if (!href || !href.startsWith("http")) {
              console.log(
                "❌ href audio tidak valid, mungkin ter-strip oleh proxy."
              );
              fs.writeFileSync(
                "debug-audio.html",
                await audioChallengeFrame.content()
              );
              return;
            }

            // 💾 Unduh audio
            const file = fs.createWriteStream("audio.mp3");
            https
              .get(href, (response) => {
                response.pipe(file);
                file.on("finish", () => {
                  file.close();
                  console.log("✅ Audio reCAPTCHA diunduh sebagai audio.mp3");
                });
              })
              .on("error", (err) => {
                fs.unlink("audio.mp3", () => {});
                console.error("❌ Gagal download:", err.message);
              });
          } catch (err) {
            console.log("❌ Gagal klik tombol audio:", err.message);
            fs.writeFileSync("debug-error.html", await page.content());
          }

          const pageq = await browser.newPage();

          // 1️⃣ Buka halaman upload
          await pageq.goto("https://audio-transcribe-ten.vercel.app/"); // contoh, ganti sesuai target kamu

          // 2️⃣ Tunggu elemen input file muncul
          await pageq.waitForSelector('input[type="file"]');

          // 3️⃣ Siapkan file yang mau diupload (pastikan path-nya absolut)
          const filePath = path.resolve("./audio.mp3");

          // 4️⃣ Ambil elemen input dan upload file
          const fileInput = await pageq.$('input[type="file"]');
          await fileInput.uploadFile(filePath);

          console.log("📤 File berhasil diupload:", filePath);

          // Pastikan pageq dan finalAudioFrame sudah terdefinisi sebelumnya

          try {
            // 1️⃣ Cari tombol di pageq
            const button = await pageq.$("button");

            if (button) {
              console.log("✅ Tombol ditemukan, klik...");

              await button.click({ clickCount: 1, delay: 100 });

              // Tunggu teks muncul setelah klik (biar gak null)
              await pageq.waitForSelector(
                "p.text-xl.text-gray-100.whitespace-pre-wrap",
                {
                  visible: true,
                  timeout: 5000,
                }
              );

              // Ambil teks-nya
              const text = await pageq.$eval(
                "p.text-xl.text-gray-100.whitespace-pre-wrap",
                (el) => el.innerText.trim()
              );

              console.log("📜 Teks ditemukan:", text);

              await page.bringToFront();

              // 2️⃣ Masukkan teks ke input audio di frame reCAPTCHA
              const inputAudio = await finalAudioFrame.$(
                "input#audio-response"
              );

              if (inputAudio) {
                console.log("🎧 Input audio ditemukan, mengetik...");

                await inputAudio.click({ clickCount: 3 });
                await inputAudio.type(text, { delay: 50 });

                await finalAudioFrame.waitForSelector(
                  "#recaptcha-verify-button",
                  {
                    visible: true,
                    timeout: 10000,
                  }
                );

                await finalAudioFrame.evaluate(() => {
                  const btn = document.querySelector(
                    "#recaptcha-verify-button"
                  );
                  if (btn) {
                    btn.scrollIntoView({ behavior: "smooth", block: "center" });
                    btn.removeAttribute("disabled"); // just in case
                    btn.click();
                  } else {
                    throw new Error("Tombol verify tidak ditemukan di frame");
                  }
                });
                console.log("✅ Tombol verify berhasil diklik!");
              } else {
                console.log(
                  "❌ Input audio tidak ditemukan di frame reCAPTCHA!"
                );
              }
            } else {
              console.log("❌ Tidak ada tombol di pageq!");
            }
          } catch (err) {
            console.error("🚨 Terjadi error:", err.message);
          }
        } catch (err) {
          console.log("❌ Gagal klik tombol audio:", err.message);
        }
      } else {
        console.log("❌ Frame audio tetap tidak ditemukan.");
      }

      console.log("✅ Audio code dikirim & tombol verify diklik.");
    }
  }

  await page.bringToFront();
  await new Promise((r) => setTimeout(r, 3000));
  await page.waitForSelector('button[type="submit"]', {
    visible: true,
  });
  const submit = await page.$('button[type="submit"]');
  if (submit) {
    await Promise.allSettled([
      page.waitForNavigation({ waitUntil: "networkidle2" }),
      submit.evaluate((btn) => btn.click()),
    ]);
    console.log("✅ Form berhasil disubmit!");
  }

  await new Promise((r) => setTimeout(r, 3000));

  // Save password record
  appendPasswordRecord({ email, password });

  console.log(
    "Form fields filled. Check browser. Password saved to",
    PASSWORD_FILE
  );

  await page.screenshot({
    path: "screenshot.png",
    fullPage: true,
  });
  console.log("📸 Screenshot full page disimpan sebagai screenshot.png");

  // leave browser open for manual inspection (remove if you want auto close)
  // await browser.close();
})();
