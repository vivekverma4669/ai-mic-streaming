const nodemailer = require("nodemailer");

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

const escapeHtml = (s = "") =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

exports.handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const data = JSON.parse(event.body || "{}");
    const { summary, meta } = data;

    if (!summary) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Missing summary in request body" }),
      };
    }

    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;
    const emailTo = process.env.EMAIL_TO || emailUser;

    if (!emailUser || !emailPass) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error:
            "Server misconfigured: Set EMAIL_USER and EMAIL_PASS in Netlify env",
        }),
      };
    }

    // ✅ IMPORTANT: Netlify Functions run on server — NO localStorage here
    // So subject/name must come from payload meta or from summary.patientDetails.name
    const patientName =
      meta?.doctorName ||
      meta?.patientName ||
      summary?.patientDetails?.name ||
      "New";

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: emailUser,
        pass: emailPass, // Gmail App Password
      },
    });

    const patient = summary?.patientDetails || {};
    const category = summary?.categorySummary || {};
    const redFlags = Array.isArray(summary?.redFlagsDetected)
      ? summary.redFlagsDetected
      : [];
    const phaseDetails = Array.isArray(summary?.phaseDetails)
      ? summary.phaseDetails
      : [];
    const fullTranscript = Array.isArray(summary?.fullTranscript)
      ? summary.fullTranscript
      : [];

    // ✅ FullTranscript now supports BOTH formats:
    // 1) old: [{q,a}]
    // 2) new: [{role,text}]
    const transcriptHtml =
      fullTranscript.length > 0
        ? fullTranscript
            .map((item) => {
              // old q/a
              if (item && (item.q !== undefined || item.a !== undefined)) {
                return `
                  <div style="margin-bottom:10px; border-bottom:1px solid #ddd; padding-bottom:6px;">
                    <p style="font-style:italic; color:#555; margin:0;">Q: ${escapeHtml(item?.q ?? "N/A")}</p>
                    <p style="margin:2px 0 0 0; color:#333;">A: ${escapeHtml(item?.a ?? "N/A")}</p>
                  </div>
                `;
              }

              // new role/text
              const role =
                item?.role === "patient"
                  ? "Patient"
                  : item?.role === "assistant"
                    ? "Assistant"
                    : "Unknown";
              return `
                <div style="margin-bottom:10px; border-bottom:1px solid #ddd; padding-bottom:6px;">
                  <p style="font-style:italic; color:#555; margin:0;">${role}:</p>
                  <p style="margin:2px 0 0 0; color:#333; white-space:pre-wrap;">${escapeHtml(
                    item?.text ?? "N/A",
                  )}</p>
                </div>
              `;
            })
            .join("")
        : "<p>N/A</p>";

    const phasesHtml =
      phaseDetails.length > 0
        ? phaseDetails
            .map((ph) => {
              const items = Array.isArray(ph?.keyFindings)
                ? ph.keyFindings
                : [];
              return `
                <div style="margin-bottom:10px; border:1px solid #ddd; border-radius:8px; padding:10px; background:#fff;">
                  <div style="font-weight:bold; color:#333; margin-bottom:6px;">${escapeHtml(
                    ph?.phase ?? "Unknown phase",
                  )}</div>
                  ${
                    items.length
                      ? `<ul style="margin:0; padding-left:18px; color:#444; font-size:13px; line-height:1.5;">
                          ${items
                            .map((k) => `<li>${escapeHtml(k)}</li>`)
                            .join("")}
                        </ul>`
                      : `<p style="margin:0; color:#777; font-size:13px;">Not reported</p>`
                  }
                </div>
              `;
            })
            .join("")
        : `<p style="margin:0; color:#777; font-size:13px;">Not reported</p>`;

    const mailOptions = {
      from: `"OCTA Bot" <${emailUser}>`,
      to: emailTo,
      subject: `🩺 ${patientName} Patient Intake Summary`,
      html: `
        <div style="font-family: Arial, sans-serif; color: #333; max-width: 720px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px; background: #fff;">
          <h2 style="color:#1a73e8; margin-bottom: 18px;">Clinical Summary Report</h2>

          <!-- ✅ Patient Details -->
          <div style="margin-bottom: 20px; padding: 12px; background: #f5f5f5; border-radius: 8px;">
            <h3 style="font-size: 13px; font-weight: bold; color:#333; margin:0 0 8px 0;">Patient Details</h3>
            <div style="font-size: 14px; line-height: 1.6;">
              <div><strong>Name:</strong> ${escapeHtml(patient?.name ?? "Not reported")}</div>
              <div><strong>Age:</strong> ${escapeHtml(patient?.age ?? "Not reported")}</div>
              <div><strong>Gender:</strong> ${escapeHtml(patient?.gender ?? "Not reported")}</div>
              <div><strong>Chief Complaint:</strong> ${escapeHtml(patient?.chiefComplaint ?? "Not reported")}</div>
              <div><strong>Pain Location:</strong> ${escapeHtml(patient?.painLocation ?? "Not reported")}</div>
              <div><strong>Duration:</strong> ${escapeHtml(patient?.duration ?? "Not reported")}</div>
            </div>
          </div>

          <div style="margin-bottom: 18px;">
            <h3 style="text-transform: uppercase; font-size: 12px; color: #555; margin:0;">Potential Clinical Impression</h3>
            <p style="font-size: 16px; color:#0b5394; margin-top:6px;">${escapeHtml(
              summary?.differentialDiagnosis ?? "Not reported",
            )}</p>
          </div>

          <div style="margin-bottom: 20px; padding: 12px; background: #f5f5f5; border-radius: 8px;">
            <h3 style="font-size: 13px; font-weight: bold; color:#333; margin:0 0 8px 0;">Category Breakdown</h3>
            <ul style="font-size: 14px; line-height: 1.6; padding-left: 20px; margin:0;">
              <li><strong>Joint Path:</strong> ${escapeHtml(category?.jointPath ?? "Not reported")}</li>
              <li><strong>Systemic:</strong> ${escapeHtml(category?.systemic ?? "Not reported")}</li>
              <li><strong>Gut:</strong> ${escapeHtml(category?.gut ?? "Not reported")}</li>
              <li><strong>Psychological:</strong> ${escapeHtml(category?.psych ?? "Not reported")}</li>
              <li><strong>Ayurvedic:</strong> ${escapeHtml(category?.ayurvedic ?? "Not reported")}</li>
            </ul>
          </div>

          ${
            redFlags.length > 0
              ? `<div style="margin-bottom:20px; padding:12px; background:#ffe5e5; border:1px solid #f5c2c2; border-radius:8px;">
                  <h3 style="font-size:13px; font-weight:bold; color:#d32f2f; margin:0 0 8px 0;">⚠ Red Flags Identified</h3>
                  <ul style="font-size:14px; padding-left:20px; color:#c62828; margin:0;">
                    ${redFlags
                      .map((rf) => `<li>${escapeHtml(rf)}</li>`)
                      .join("")}
                  </ul>
                </div>`
              : ""
          }

          <!-- ✅ Phase Details -->
          <div style="margin-bottom: 20px;">
            <h3 style="text-transform: uppercase; font-size: 12px; color: #555; margin:0 0 10px 0;">Phase Details</h3>
            <div style="background:#f5f5f5; border:1px solid #ddd; padding:10px; border-radius:8px;">
              ${phasesHtml}
            </div>
          </div>

          <div>
            <h3 style="text-transform: uppercase; font-size: 12px; color: #555; margin:0 0 10px 0;">Full Transcript</h3>
            <div style="max-height: 320px; overflow-y: auto; background: #f5f5f5; border: 1px solid #ddd; padding:10px; border-radius:8px; font-size:13px;">
              ${transcriptHtml}
            </div>
          </div>

          <p style="margin-top:20px; font-size:11px; color:#777;">
            This summary was automatically generated by OCTA Bot.
          </p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true }),
    };
  } catch (error) {
    console.error("Email error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "Failed to send email",
        details: error.message,
      }),
    };
  }
};
