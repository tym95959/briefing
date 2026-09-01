const {
    neon
} = require(
    "@neondatabase/serverless"
);


function text(
    value,
    maxLength = 2000
){

    return String(
        value ?? ""
    )
    .trim()
    .slice(
        0,
        maxLength
    );

}


function numberOrNull(
    value
){

    if(
        value === null ||
        value === undefined ||
        value === ""
    ){
        return null;
    }


    const number =
        Number(
            value
        );


    return Number.isFinite(
        number
    )
        ? number
        : null;

}


module.exports =
async function handler(
    req,
    res
){

    res.setHeader(
        "Content-Type",
        "application/json"
    );


    res.setHeader(
        "Cache-Control",
        "no-store"
    );


    if(
        req.method !==
        "POST"
    ){

        res.setHeader(
            "Allow",
            "POST"
        );


        return res
        .status(405)
        .json({

            success:false,

            message:
                "Method not allowed"

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


        let body =
            req.body || {};


        /*
         * Some environments can provide
         * the body as a JSON string.
         */

        if(
            typeof body ===
            "string"
        ){

            try{

                body =
                    JSON.parse(
                        body
                    );

            }catch(_){

                return res
                .status(400)
                .json({

                    success:false,

                    message:
                        "Invalid survey data."

                });

            }

        }


        const company =
            text(
                body.company,
                250
            );


        const documentNumber =
            text(
                body.documentNumber,
                100
            );


        const flightNumber =
            text(
                body.flightNumber,
                100
            )
            .toUpperCase();


        const destination =
            text(
                body.destination,
                250
            );


        const airline =
            text(
                body.airline,
                250
            );


        const accessType =
            text(
                body.accessType,
                250
            );


        const likedMost =
            text(
                body.likedMost,
                5000
            );


        const improvement =
            text(
                body.improvement,
                5000
            );


        const comments =
            text(
                body.comments,
                5000
            );


        const overallRating =
            numberOrNull(
                body.overallRating
            );


        const recommendationScore =
            numberOrNull(
                body.recommendationScore
            );


        /*
         * Validate overall rating.
         */

        if(
            overallRating === null ||
            overallRating < 1 ||
            overallRating > 5
        ){

            return res
            .status(400)
            .json({

                success:false,

                message:
                    "Overall rating must be between 1 and 5."

            });

        }


        /*
         * Validate recommendation.
         */

        if(
            recommendationScore === null ||
            recommendationScore < 0 ||
            recommendationScore > 10
        ){

            return res
            .status(400)
            .json({

                success:false,

                message:
                    "Recommendation score must be between 0 and 10."

            });

        }


        /*
         * Clean all dynamic question answers.
         */

        const incomingAnswers =
            Array.isArray(
                body.answers
            )
                ? body.answers
                : [];


        const answers =
            incomingAnswers
            .map(
                answer => {

                    const rating =
                        Number(
                            answer.rating
                        );


                    const questionId =
                        Number(
                            answer.questionId
                        );


                    if(
                        !Number.isFinite(
                            rating
                        ) ||
                        rating < 1 ||
                        rating > 5
                    ){

                        return null;

                    }


                    return {

                        questionId:
                            Number.isFinite(
                                questionId
                            )
                                ? questionId
                                : null,

                        questionKey:
                            text(
                                answer.questionKey,
                                250
                            ),

                        questionTitle:
                            text(
                                answer.questionTitle,
                                500
                            ),

                        rating:
                            rating

                    };

                }
            )
            .filter(
                answer =>
                    answer &&
                    answer.questionKey &&
                    answer.questionTitle
            );


        /*
         * Calculate service average.
         */

        let averageRating =
            null;


        if(
            answers.length
        ){

            const total =
                answers.reduce(
                    (
                        sum,
                        answer
                    ) => {

                        return (
                            sum +
                            answer.rating
                        );

                    },
                    0
                );


            averageRating =
                Number(
                    (
                        total /
                        answers.length
                    )
                    .toFixed(
                        2
                    )
                );

        }


        /*
         * Save main survey.
         */

        const insertedSurvey =
            await sql`

                INSERT INTO
                    lounge_surveys
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
                    ${company},
                    ${documentNumber},
                    ${flightNumber},
                    ${destination},
                    ${airline},
                    ${accessType},
                    ${overallRating},
                    ${recommendationScore},
                    ${likedMost},
                    ${improvement},
                    ${comments},
                    ${averageRating}
                )

                RETURNING
                    id,
                    submitted_at

            `;


        const survey =
            insertedSurvey[0];


        if(
            !survey ||
            !survey.id
        ){

            throw new Error(
                "Survey record was not created."
            );

        }


        /*
         * Save EVERY rating separately.
         */

        for(
            const answer
            of answers
        ){

            await sql`

                INSERT INTO
                    lounge_survey_answers
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


        return res
        .status(200)
        .json({

            success:true,

            surveyId:
                survey.id,

            submittedAt:
                survey.submitted_at,

            answersSaved:
                answers.length,

            averageRating:
                averageRating

        });


    }catch(error){

        console.error(
            "Save survey error:",
            error
        );


        return res
        .status(500)
        .json({

            success:false,

            message:
                error.message ||
                "Unable to save survey."

        });

    }

};
