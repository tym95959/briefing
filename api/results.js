const {
    neon
} = require(
    "@neondatabase/serverless"
);


function authorized(req){

    const supplied =
        String(
            req.headers[
                "x-admin-password"
            ] || ""
        );


    const expected =
        String(
            process.env
            .SURVEY_ADMIN_PASSWORD ||
            ""
        );


    return (
        expected &&
        supplied === expected
    );

}


module.exports =
async function handler(
    req,
    res
){

    res.setHeader(
        "Cache-Control",
        "no-store"
    );


    if(
        req.method !==
        "GET"
    ){

        return res
        .status(405)
        .json({

            success:false,

            message:
                "Method not allowed"

        });

    }


    if(
        !authorized(req)
    ){

        return res
        .status(401)
        .json({

            success:false,

            message:
                "Invalid admin password."

        });

    }


    if(
        !process.env
        .DATABASE_URL
    ){

        return res
        .status(500)
        .json({

            success:false,

            message:
                "DATABASE_URL is not configured."

        });

    }


    try{

        const sql =
            neon(
                process.env
                .DATABASE_URL
            );


        const from =
            String(
                req.query?.from ||
                ""
            )
            .trim();


        const to =
            String(
                req.query?.to ||
                ""
            )
            .trim();


        /* =================================================
           SURVEY LIST
        ================================================= */

        let surveys;


        if(
            from &&
            to
        ){

            surveys =
                await sql`

                    SELECT
                        *

                    FROM
                        lounge_surveys

                    WHERE
                        submitted_at >=
                            ${from}::date

                    AND
                        submitted_at <
                            (
                                ${to}::date +
                                INTERVAL '1 day'
                            )

                    ORDER BY
                        submitted_at DESC

                `;

        }

        else if(
            from
        ){

            surveys =
                await sql`

                    SELECT
                        *

                    FROM
                        lounge_surveys

                    WHERE
                        submitted_at >=
                            ${from}::date

                    ORDER BY
                        submitted_at DESC

                `;

        }

        else if(
            to
        ){

            surveys =
                await sql`

                    SELECT
                        *

                    FROM
                        lounge_surveys

                    WHERE
                        submitted_at <
                            (
                                ${to}::date +
                                INTERVAL '1 day'
                            )

                    ORDER BY
                        submitted_at DESC

                `;

        }

        else{

            surveys =
                await sql`

                    SELECT
                        *

                    FROM
                        lounge_surveys

                    ORDER BY
                        submitted_at DESC

                `;

        }


        /* =================================================
           QUESTION STATS
        ================================================= */

        let questionStats;


        if(
            from &&
            to
        ){

            questionStats =
                await sql`

                    SELECT

                        a.question_key,

                        MAX(
                            a.question_title
                        )
                        AS question_title,

                        ROUND(
                            AVG(
                                a.rating
                            )::numeric,
                            2
                        )
                        AS average_rating,

                        COUNT(*)
                        AS response_count,

                        COUNT(*)
                        FILTER(
                            WHERE
                                a.rating = 5
                        )
                        AS rating_5,

                        COUNT(*)
                        FILTER(
                            WHERE
                                a.rating = 4
                        )
                        AS rating_4,

                        COUNT(*)
                        FILTER(
                            WHERE
                                a.rating = 3
                        )
                        AS rating_3,

                        COUNT(*)
                        FILTER(
                            WHERE
                                a.rating = 2
                        )
                        AS rating_2,

                        COUNT(*)
                        FILTER(
                            WHERE
                                a.rating = 1
                        )
                        AS rating_1,

                        COALESCE(
                            MIN(
                                q.display_order
                            ),
                            999999
                        )
                        AS display_order

                    FROM
                        lounge_survey_answers a

                    INNER JOIN
                        lounge_surveys s

                    ON
                        s.id =
                        a.survey_id

                    LEFT JOIN
                        survey_questions q

                    ON
                        q.id =
                        a.question_id

                    WHERE
                        s.submitted_at >=
                            ${from}::date

                    AND
                        s.submitted_at <
                            (
                                ${to}::date +
                                INTERVAL '1 day'
                            )

                    GROUP BY
                        a.question_key

                    ORDER BY
                        display_order,
                        question_title

                `;

        }

        else if(
            from
        ){

            questionStats =
                await sql`

                    SELECT

                        a.question_key,

                        MAX(
                            a.question_title
                        )
                        AS question_title,

                        ROUND(
                            AVG(
                                a.rating
                            )::numeric,
                            2
                        )
                        AS average_rating,

                        COUNT(*)
                        AS response_count,

                        COUNT(*)
                        FILTER(
                            WHERE a.rating = 5
                        )
                        AS rating_5,

                        COUNT(*)
                        FILTER(
                            WHERE a.rating = 4
                        )
                        AS rating_4,

                        COUNT(*)
                        FILTER(
                            WHERE a.rating = 3
                        )
                        AS rating_3,

                        COUNT(*)
                        FILTER(
                            WHERE a.rating = 2
                        )
                        AS rating_2,

                        COUNT(*)
                        FILTER(
                            WHERE a.rating = 1
                        )
                        AS rating_1,

                        COALESCE(
                            MIN(
                                q.display_order
                            ),
                            999999
                        )
                        AS display_order

                    FROM
                        lounge_survey_answers a

                    INNER JOIN
                        lounge_surveys s

                    ON
                        s.id =
                        a.survey_id

                    LEFT JOIN
                        survey_questions q

                    ON
                        q.id =
                        a.question_id

                    WHERE
                        s.submitted_at >=
                            ${from}::date

                    GROUP BY
                        a.question_key

                    ORDER BY
                        display_order,
                        question_title

                `;

        }

        else if(
            to
        ){

            questionStats =
                await sql`

                    SELECT

                        a.question_key,

                        MAX(
                            a.question_title
                        )
                        AS question_title,

                        ROUND(
                            AVG(
                                a.rating
                            )::numeric,
                            2
                        )
                        AS average_rating,

                        COUNT(*)
                        AS response_count,

                        COUNT(*)
                        FILTER(
                            WHERE a.rating = 5
                        )
                        AS rating_5,

                        COUNT(*)
                        FILTER(
                            WHERE a.rating = 4
                        )
                        AS rating_4,

                        COUNT(*)
                        FILTER(
                            WHERE a.rating = 3
                        )
                        AS rating_3,

                        COUNT(*)
                        FILTER(
                            WHERE a.rating = 2
                        )
                        AS rating_2,

                        COUNT(*)
                        FILTER(
                            WHERE a.rating = 1
                        )
                        AS rating_1,

                        COALESCE(
                            MIN(
                                q.display_order
                            ),
                            999999
                        )
                        AS display_order

                    FROM
                        lounge_survey_answers a

                    INNER JOIN
                        lounge_surveys s

                    ON
                        s.id =
                        a.survey_id

                    LEFT JOIN
                        survey_questions q

                    ON
                        q.id =
                        a.question_id

                    WHERE
                        s.submitted_at <
                            (
                                ${to}::date +
                                INTERVAL '1 day'
                            )

                    GROUP BY
                        a.question_key

                    ORDER BY
                        display_order,
                        question_title

                `;

        }

        else{

            questionStats =
                await sql`

                    SELECT

                        a.question_key,

                        MAX(
                            a.question_title
                        )
                        AS question_title,

                        ROUND(
                            AVG(
                                a.rating
                            )::numeric,
                            2
                        )
                        AS average_rating,

                        COUNT(*)
                        AS response_count,

                        COUNT(*)
                        FILTER(
                            WHERE a.rating = 5
                        )
                        AS rating_5,

                        COUNT(*)
                        FILTER(
                            WHERE a.rating = 4
                        )
                        AS rating_4,

                        COUNT(*)
                        FILTER(
                            WHERE a.rating = 3
                        )
                        AS rating_3,

                        COUNT(*)
                        FILTER(
                            WHERE a.rating = 2
                        )
                        AS rating_2,

                        COUNT(*)
                        FILTER(
                            WHERE a.rating = 1
                        )
                        AS rating_1,

                        COALESCE(
                            MIN(
                                q.display_order
                            ),
                            999999
                        )
                        AS display_order

                    FROM
                        lounge_survey_answers a

                    LEFT JOIN
                        survey_questions q

                    ON
                        q.id =
                        a.question_id

                    GROUP BY
                        a.question_key

                    ORDER BY
                        display_order,
                        question_title

                `;

        }


        /* =================================================
           SUMMARY CALCULATION
        ================================================= */

        const responseCount =
            surveys.length;


        const overallValues =
            surveys
            .map(
                item =>
                    Number(
                        item.overall_rating
                    )
            )
            .filter(
                Number.isFinite
            );


        const recommendationValues =
            surveys
            .map(
                item =>
                    Number(
                        item.recommendation_score
                    )
            )
            .filter(
                Number.isFinite
            );


        const questionValues =
            questionStats
            .map(
                item =>
                    Number(
                        item.average_rating
                    )
            )
            .filter(
                Number.isFinite
            );


        const overallAverage =
            average(
                overallValues
            );


        const recommendationAverage =
            average(
                recommendationValues
            );


        const questionAverage =
            average(
                questionValues
            );


        /* =================================================
           NPS
        ================================================= */

        let promoters = 0;
        let detractors = 0;


        recommendationValues
        .forEach(
            score => {

                if(
                    score >= 9
                ){

                    promoters++;

                }

                else if(
                    score <= 6
                ){

                    detractors++;

                }

            }
        );


        let nps = 0;


        if(
            recommendationValues.length
        ){

            nps =
                (
                    promoters /
                    recommendationValues.length
                    *
                    100
                )
                -
                (
                    detractors /
                    recommendationValues.length
                    *
                    100
                );

        }


        /* =================================================
           SETTINGS
        ================================================= */

        let settings =
            null;


        try{

            const settingRows =
                await sql`

                    SELECT

                        company_name,
                        document_number

                    FROM
                        survey_settings

                    WHERE
                        id = 1

                `;


            settings =
                settingRows[0] ||
                null;

        }catch(_){

            settings =
                null;

        }


        return res
        .status(200)
        .json({

            success:true,

            surveys,

            questionStats,

            summary:{

                responses:
                    responseCount,

                overallAverage,

                questionAverage,

                recommendationAverage,

                nps

            },

            settings

        });


    }catch(error){

        console.error(
            "Survey results API error:",
            error
        );


        return res
        .status(500)
        .json({

            success:false,

            message:
                error.message ||
                "Unable to load survey results."

        });

    }

};


function average(
    values
){

    if(
        !values.length
    ){

        return 0;

    }


    return (
        values.reduce(
            (
                total,
                value
            ) =>
                total +
                value,
            0
        )
        /
        values.length
    );

}
