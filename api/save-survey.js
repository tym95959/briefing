import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

export default async function handler(req, res) {

    if (req.method !== "POST") {
        return res.status(405).json({
            success: false,
            message: "Method not allowed"
        });
    }

    try {

        const data = req.body || {};

        const ratings = data.ratings || {};

        const result = await sql`

            INSERT INTO lounge_surveys (

                company,
                document_number,

                flight_number,
                destination,
                airline,
                access_type,

                greeting,
                professionalism,
                attitude,
                speed,
                cleanliness,
                comfort,
                ambience,
                food_quality,
                food_choice,
                beverages,
                wifi,
                washroom,
                announcements,

                average_rating,

                overall_rating,
                recommendation_score,

                liked_most,
                improvement,
                comments

            )

            VALUES (

                ${data.company || null},
                ${data.documentNumber || null},

                ${data.flightNumber || null},
                ${data.destination || null},
                ${data.airline || null},
                ${data.accessType || null},

                ${ratings.greeting ?? null},
                ${ratings.professionalism ?? null},
                ${ratings.attitude ?? null},
                ${ratings.speed ?? null},
                ${ratings.cleanliness ?? null},
                ${ratings.comfort ?? null},
                ${ratings.ambience ?? null},
                ${ratings.foodQuality ?? null},
                ${ratings.foodChoice ?? null},
                ${ratings.beverages ?? null},
                ${ratings.wifi ?? null},
                ${ratings.washroom ?? null},
                ${ratings.announcements ?? null},

                ${data.averageRating ?? null},

                ${data.overallRating ?? null},
                ${data.recommendationScore ?? null},

                ${data.likedMost || null},
                ${data.improvement || null},
                ${data.comments || null}

            )

            RETURNING
                id,
                submitted_at

        `;

        return res.status(200).json({
            success: true,
            id: result[0]?.id,
            submittedAt: result[0]?.submitted_at
        });

    } catch (error) {

        console.error(
            "Survey save error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Unable to save survey"
        });

    }

}
