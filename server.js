import express from "express";
import fetch from "node-fetch";
import crypto from "crypto";
const app = express();
const PORT = process.env.PORT || 10000;
const PIXEL_ID = process.env.PIXEL_ID || "879323721812960";
const ACCESS_TOKEN = process.env.ACCESS_TOKEN || "EAAPpPjFeXsUBSunwcTknIG1nMMLr7kmcXERZCsW0VVz9dyppOZCNSwqICaKpIYBw2ltvmDYIlg6ZCQcsjH4RlRElrb8s9GZAtNcZB4JKpnZC0UqjfnojTJV9TLJpYMyKLiYXV7nUva36s7rXdF5J61ToP0nieDI3dRQnIZBLZCyuCq1y6wkjz0BKhtGGoeWK0ZAru7wZDZD";
const API_VERSION = "v21.0";
const hash = (value) =>
  value ? crypto.createHash("sha256").update(String(value).trim().toLowerCase()).digest("hex") : undefined;
const isReal = (val) => val && !val.includes("{") && val.trim() !== "";
app.get("/capi", async (req, res) => {
  const { event, subid, amount, fbclid, fbp, ua, ip, landing, test_event_code } = req.query;
  console.log("📩 Входящий постбек:", req.query);
  if (!subid) {
    return res.status(400).json({ status: "error", message: "Missing subid" });
  }
  let cleanDomain = "orbitflow.lol";
  if (isReal(landing)) {
    cleanDomain = landing.replace(/^https?:\/\//, "").split("/")[0];
  }
  const event_source_url = `https://${cleanDomain}/`;
  const fbc = isReal(fbclid)
    ? `fb.1.${Math.floor(Date.now() / 1000)}.${fbclid}`
    : undefined;
  let event_name;
  if (event === "sale") {
    event_name = "Purchase";
  } else {
    event_name = "CompleteRegistration";
  }
  const isPurchase = event_name === "Purchase";
  const event_id = `${subid}_${event_name}`;
  const user_data = {
    client_user_agent: ua || undefined,
    client_ip_address: ip || undefined,
    external_id: hash(subid),
    fbc: fbc,
    fbp: isReal(fbp) ? fbp : undefined,
  };
  Object.keys(user_data).forEach((k) => user_data[k] === undefined && delete user_data[k]);
  const eventData = {
    event_name,
    event_time: Math.floor(Date.now() / 1000),
    action_source: "website",
    event_id,
    event_source_url,
    user_data,
    custom_data: isPurchase
      ? { currency: "USD", value: parseFloat(amount) || 0 }
      : { content_name: "registration" },
  };
  const payload = { data: [eventData] };
  if (isReal(test_event_code)) {
    payload.test_event_code = test_event_code;
  }
  try {
    const fbURL = `https://graph.facebook.com/${API_VERSION}/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`;
    const response = await fetch(fbURL, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
    });
    const result = await response.json();
    if (result.error) {
      console.error(`❌ FB error для ${subid}:`, result.error);
      return res.status(400).json({ status: "fb_error", fb: result });
    }
    console.log(`✅ ${event_name} для ${subid}: events_received=${result.events_received}`);
    return res.json({ status: "OK", event: event_name, fb: result });
  } catch (error) {
    console.error("❌ Ошибка отправки:", error.message);
    return res.status(500).json({ status: "error", message: error.message });
  }
});
app.get("/", (req, res) => res.json({ status: "alive" }));
app.listen(PORT, () => console.log(`🚀 CAPI сервер на порту ${PORT}`));
