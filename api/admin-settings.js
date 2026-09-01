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


function clean(
    value,
    maxLength = 1000
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


    if(
        !process.env
        .SURVEY_ADMIN_PASSWORD
    ){

        return res
        .status(500)
        .json({

            success:false,

            message:
                "SURVEY_ADMIN_PASSWORD is not configured."

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


    try{

        const sql =
            neon(
                process.env
                .DATABASE_URL
            );


        if(
            req.method === "GET"
        ){

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
                        hero_image,
                        updated_at

                    FROM
                        survey_settings

                    WHERE
                        id = 1

                    LIMIT 1

                `;


            return res
            .status(200)
            .json({

                success:true,

                settings:
                    rows[0] ||
                    null

            });

        }


        if(
            req.method === "PUT"
        ){

            let body =
                req.body || {};


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
                            "Invalid settings data."

                    });

                }

            }


            const companyName =
                clean(
                    body.companyName,
                    200
                );


            const addressLine1 =
                clean(
                    body.addressLine1,
                    300
                );


            const addressLine2 =
                clean(
                    body.addressLine2,
                    300
                );


            const documentNumber =
                clean(
                    body.documentNumber,
                    100
                );


            const heroBadge =
                clean(
                    body.heroBadge,
                    250
                );


            const surveyHeading =
                clean(
                    body.surveyHeading,
                    250
                );


            const surveyDescription =
                clean(
                    body.surveyDescription,
                    2000
                );


            const optionalBadge =
                clean(
                    body.optionalBadge,
                    250
                );


            let heroImage =
                clean(
                    body.heroImage,
                    500
                );


            if(
                !heroImage
            ){

                heroImage =
                    "/KoveliLounge.jpg";

            }


            if(
                !companyName
            ){

                return res
                .status(400)
                .json({

                    success:false,

                    message:
                        "Company name is required."

                });

            }


            const rows =
                await sql`

                    INSERT INTO
                        survey_settings
                    (
                        id,
                        company_name,
                        address_line1,
                        address_line2,
                        document_number,
                        hero_badge,
                        survey_heading,
                        survey_description,
                        optional_badge,
                        hero_image,
                        updated_at
                    )

                    VALUES
                    (
                        1,
                        ${companyName},
                        ${addressLine1},
                        ${addressLine2},
                        ${documentNumber},
                        ${heroBadge},
                        ${surveyHeading},
                        ${surveyDescription},
                        ${optionalBadge},
                        ${heroImage},
                        NOW()
                    )

                    ON CONFLICT (id)

                    DO UPDATE SET

                        company_name =
                            EXCLUDED.company_name,

                        address_line1 =
                            EXCLUDED.address_line1,

                        address_line2 =
                            EXCLUDED.address_line2,

                        document_number =
                            EXCLUDED.document_number,

                        hero_badge =
                            EXCLUDED.hero_badge,

                        survey_heading =
                            EXCLUDED.survey_heading,

                        survey_description =
                            EXCLUDED.survey_description,

                        optional_badge =
                            EXCLUDED.optional_badge,

                        hero_image =
                            EXCLUDED.hero_image,

                        updated_at =
                            NOW()

                    RETURNING
                        *

                `;


            return res
            .status(200)
            .json({

                success:true,

                settings:
                    rows[0]

            });

        }


        return res
        .status(405)
        .json({

            success:false,

            message:
                "Method not allowed."

        });


    }catch(error){

        console.error(
            "Admin settings error:",
            error
        );


        return res
        .status(500)
        .json({

            success:false,

            message:
                error.message ||
                "Unable to save survey settings."

        });

    }

};
