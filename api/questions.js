import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

export default async function handler(req, res) {
    try {
        if (req.method !== "GET") {
            return res.status(405).json({ success: false, message: "Method not allowed" });
        }

        const rows = await sql`
            SELECT
                id,
                question_key,
                title,
                icon,
                display_order,
                required,
                active
            FROM survey_questions
            WHERE active = TRUE
            ORDER BY display_order ASC, id ASC
        `;

        return res.status(200).json({
            success: true,
            questions: rows
        });

    } catch (error) {
        console.error("Questions load error:", error);
        return res.status(500).json({
            success: false,
            message: "Unable to load survey questions"
        });
    }
}
