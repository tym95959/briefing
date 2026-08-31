import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

function text(value, max = 1000) {
    const clean = String(value || "").trim();
    return clean ? clean.slice(0, max) : null;
}

function integerOrNull(value) {
    if (value === null || value === undefined || value === "") return null;
    const n = Number(value);
    return Number.isInteger(n) ? n : null;
}

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({
            success: false,
            message: "Method not allowed"
        });
    }

    try {
        const data = req.body || {};
        const answers = Array.isArray(data.answers) ? data.answers : [];

        const overall = integerOrNull(data.overallRating);
        const nps = integerOrNull(data.recommendationScore);

        if (overall === null || overall < 1 || overall > 5) {
            return res.status(400).json({
                success: false,
                message: "Please select your overall lounge experience"
            });
        }

        if (nps === null || nps < 0 || nps > 10) {
            return res.status(400).json({
                success: false,
                message: "Please select a recommendation score"
            });
        }

        const activeQuestions = await sql`
            SELECT
                id,
                question_key,
                title,
                required
            FROM survey_questions
            WHERE active = TRUE
            ORDER BY display_order ASC, id ASC
        `;

        const answerMap = new Map(
            answers.map(a => [String(a.questionKey || ""), Number(a.rating)])
        );

        for (const q of activeQuestions) {
            if (q.required) {
                const rating = answerMap.get(q.question_key);
                if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
                    return res.status(400).json({
                        success: false,
                        message: `Please rate: ${q.title}`
                    });
                }
            }
        }

        const validAnswers = [];

        for (const q of activeQuestions) {
            const rating = answerMap.get(q.question_key);

            if (Number.isInteger(rating) && rating >= 1 && rating <= 5) {
                validAnswers.push({
                    questionId: q.id,
                    questionKey: q.question_key,
                    questionTitle: q.title,
                    rating
                });
            }
        }

        const averageRating = validAnswers.length
            ? Number(
                (
                    validAnswers.reduce((sum, a) => sum + a.rating, 0) /
                    validAnswers.length
                ).toFixed(2)
            )
            : null;

        const surveys = await sql`
            INSERT INTO lounge_surveys
            (
                company,
                document_number,
                flight_number,
                destination,
                airline,
                access_type,
                overall_rating,
                recommendation_score,
                liked_most,
                improvement,
                comments,
                average_rating
            )
            VALUES
            (
                ${text(data.company, 200)},
                ${text(data.documentNumber, 100)},
                ${text(data.flightNumber, 100)},
                ${text(data.destination, 200)},
                ${text(data.airline, 200)},
                ${text(data.accessType, 100)},
                ${overall},
                ${nps},
                ${text(data.likedMost, 2000)},
                ${text(data.improvement, 2000)},
                ${text(data.comments, 2000)},
                ${averageRating}
            )
            RETURNING id, submitted_at
        `;

        const survey = surveys[0];

        try {
            for (const answer of validAnswers) {
                await sql`
                    INSERT INTO lounge_survey_answers
                    (
                        survey_id,
                        question_id,
                        question_key,
                        question_title,
                        rating
                    )
                    VALUES
                    (
                        ${survey.id},
                        ${answer.questionId},
                        ${answer.questionKey},
                        ${answer.questionTitle},
                        ${answer.rating}
                    )
                `;
            }
        } catch (answerError) {
            await sql`
                DELETE FROM lounge_surveys
                WHERE id = ${survey.id}
            `;
            throw answerError;
        }

        return res.status(200).json({
            success: true,
            id: survey.id,
            submittedAt: survey.submitted_at
        });

    } catch (error) {
        console.error("Survey save error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to save survey"
        });
    }
}
