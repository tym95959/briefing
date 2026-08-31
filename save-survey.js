import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

function authorized(req) {
    const supplied = String(req.headers["x-admin-password"] || "");
    const expected = String(process.env.SURVEY_ADMIN_PASSWORD || "");
    return expected && supplied === expected;
}

function makeKey(title) {
    const base = String(title || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 45);

    return `${base || "question"}_${Date.now().toString(36)}`;
}

export default async function handler(req, res) {
    if (!authorized(req)) {
        return res.status(401).json({
            success: false,
            message: "Invalid admin password"
        });
    }

    try {
        if (req.method === "GET") {
            const rows = await sql`
                SELECT
                    id,
                    question_key,
                    title,
                    icon,
                    display_order,
                    required,
                    active,
                    created_at,
                    updated_at
                FROM survey_questions
                ORDER BY display_order ASC, id ASC
            `;

            return res.status(200).json({
                success: true,
                questions: rows
            });
        }

        if (req.method === "POST") {
            const body = req.body || {};
            const title = String(body.title || "").trim();

            if (!title) {
                return res.status(400).json({
                    success: false,
                    message: "Question title is required"
                });
            }

            const questionKey = makeKey(title);
            const icon = String(body.icon || "✨").trim().slice(0, 20);
            const displayOrder = Number.isFinite(Number(body.displayOrder))
                ? Number(body.displayOrder)
                : 0;
            const required = Boolean(body.required);
            const active = body.active !== false;

            const rows = await sql`
                INSERT INTO survey_questions
                (
                    question_key,
                    title,
                    icon,
                    display_order,
                    required,
                    active
                )
                VALUES
                (
                    ${questionKey},
                    ${title},
                    ${icon || "✨"},
                    ${displayOrder},
                    ${required},
                    ${active}
                )
                RETURNING *
            `;

            return res.status(201).json({
                success: true,
                question: rows[0]
            });
        }

        if (req.method === "PUT") {
            const body = req.body || {};
            const id = Number(body.id);

            if (!Number.isInteger(id) || id <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid question ID"
                });
            }

            const title = String(body.title || "").trim();

            if (!title) {
                return res.status(400).json({
                    success: false,
                    message: "Question title is required"
                });
            }

            const icon = String(body.icon || "✨").trim().slice(0, 20);
            const displayOrder = Number.isFinite(Number(body.displayOrder))
                ? Number(body.displayOrder)
                : 0;
            const required = Boolean(body.required);
            const active = body.active !== false;

            const rows = await sql`
                UPDATE survey_questions
                SET
                    title = ${title},
                    icon = ${icon || "✨"},
                    display_order = ${displayOrder},
                    required = ${required},
                    active = ${active},
                    updated_at = NOW()
                WHERE id = ${id}
                RETURNING *
            `;

            if (!rows.length) {
                return res.status(404).json({
                    success: false,
                    message: "Question not found"
                });
            }

            return res.status(200).json({
                success: true,
                question: rows[0]
            });
        }

        if (req.method === "DELETE") {
            const id = Number(req.query.id);

            if (!Number.isInteger(id) || id <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid question ID"
                });
            }

            const rows = await sql`
                DELETE FROM survey_questions
                WHERE id = ${id}
                RETURNING id
            `;

            if (!rows.length) {
                return res.status(404).json({
                    success: false,
                    message: "Question not found"
                });
            }

            return res.status(200).json({
                success: true
            });
        }

        return res.status(405).json({
            success: false,
            message: "Method not allowed"
        });

    } catch (error) {
        console.error("Admin question API error:", error);

        return res.status(500).json({
            success: false,
            message: "Database operation failed"
        });
    }
}