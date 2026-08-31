const {
    neon
} = require(
    "@neondatabase/serverless"
);


module.exports =
async function handler(
    req,
    res
) {

    res.setHeader(
        "Cache-Control",
        "no-store"
    );


    if (
        req.method !== "GET"
    ) {

        return res
            .status(405)
            .json({
                success: false,
                message: "Method not allowed"
            });

    }


    try {

        if (
            !process.env.DATABASE_URL
        ) {

            throw new Error(
                "DATABASE_URL is not configured."
            );

        }


        const sql =
            neon(
                process.env.DATABASE_URL
            );


        const rows =
            await sql`

                SELECT

                    company_name,
                    address_line1,
                    address_line2,
                    document_number,
                    hero_badge,
                    survey_heading,
                    survey_description,
                    optional_badge,
                    hero_image

                FROM survey_settings

                WHERE id = 1

                LIMIT 1

            `;


        const settings =
            rows[0] || {

                company_name:
                    "YOUR COMPANY NAME",

                address_line1:
                    "Velana International Airport",

                address_line2:
                    "Hulhulé, Republic of Maldives",

                document_number:
                    "SUR-FB-001",

                hero_badge:
                    "✈ Airport Lounge Guest Experience",

                survey_heading:
                    "We Value Your Feedback",

                survey_description:
                    "Your feedback helps us improve the comfort, facilities, food and service provided to our guests. The survey takes approximately one minute to complete.",

                optional_badge:
                    "Passenger details are optional",

                hero_image:
                    "/KoveliLounge.jpg"

            };


        return res
            .status(200)
            .json({

                success: true,

                settings

            });


    } catch (error) {

        console.error(
            "Survey settings error:",
            error
        );


        return res
            .status(500)
            .json({

                success: false,

                message:
                    error.message ||
                    "Unable to load survey settings."

            });

    }

};
