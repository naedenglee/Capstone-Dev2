//node modules
const express = require('express')
const axios = require('axios')
const bcrypt = require('bcryptjs')
const bodyParser = require('body-parser')
const nodemailer = require('nodemailer')
const otpGenerator = require('otp-generator')
const multer = require('multer')
var session = require('cookie-session')
const cloudinary = require('cloudinary').v2

//for postgres
const { Client } = require('pg')

//for multer(image upload)
const path = require('path')
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, '/views/images')
    }
})
const upload = multer({storage: storage})

// CLOUDINARY (UPLOAD)
cloudinary.config({ 
    cloud_name: 'ddk9lffn7', 
    api_key: '646917413963653', 
    api_secret: 'ptjD8QM9epsZPnkBPX_mRC7JF-Y',
    secure: true 
  });

//
const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });
  client.connect()

//app.use
const app = express()
app.use(express.static('views'))

app.use(session({
    name: 'session',
    keys: ['key1', 'key2']
}))

app.use(bodyParser.urlencoded({ extended: true, limit: '50mb'}))
app.set('trust proxy', 1)


let port = process.env.PORT || 4200
app.listen(port, () => {
    console.log(`app is listening on http://localhost:${port}` );
});


//view engine(EJS)
app.set('view engine', 'ejs')

//ROUTES
app.get("/", (req,res) =>{
    var user = req.session.username;
    var cart_count = req.session.cart_count
    var user_id = req.session.userid
    var currency = req.session.currency

    res.render('pages/homepage', { user, cart_count, currency })
    
});

//VALIDATIONof login
app.post('/login', (req, res)=>{

    var sqlQuery = {
        text: `CALL check_login($1, $2, NULL)`,
        values: [req.body.user, req.body.pass]
    }

    client.query(`SET SCHEMA 'public'`)
    client.query(sqlQuery, (error, result) => {
        if(error){
            console.log(error)
            res.send('error1')
        }
        else if(!error){
            let {vid} = result.rows[0]

            if(vid == null){ // DATABASE RETURNS vid NULL 
                return res.send('ACCOUNT DOES NOT EXIST');
            }

            else if(vid != null){ // IF ACCOUNT DOES EXIST
                let {vpassword} = result.rows[0]
                validPass = bcrypt.compareSync(req.body.pass, vpassword) 
                if(!validPass){
                    res.send('WRONG PASSWORD ENTER YOUR PASSWORD AGAIN!')
                    //refresh password forms
                }
                else{
                    console.log('YOU ARE NOW LOGGED IN')
                    console.log(req.body.user)
                    req.session.username = req.body.user;
                    // var user = req.session.username
                    let cartQuery = {
                        text: `SELECT 1 FROM cart WHERE account_id = $1`,
                        values: [vid] 
                    }
                    client.query(cartQuery, (error, result) =>{
                        if(error){
                            console.log('CART error')
                            console.log(error)
                        }
                        else if(!error){
                            console.log('GOOD CART QUERY')
                            req.session.cart_count = result.rows.length
                            console.log(vid)
                        }
                    })

                    let currencyQuery = {
                        text: `SELECT user_currency FROM account_currency WHERE account_id = $1`,
                        values: [vid]
                    }

                    client.query(currencyQuery, (error, result) =>{
                        if(error){
                            console.log('WALLET error')
                            console.log(error)
                        }
                        else if(!error){
                            console.log('GOOD WALLET QUERY')                
                            console.log(result.rows[0].user_currency)
                            req.session.currency = result.rows[0].user_currency
                            currency = req.session.currency
                            req.session.user_id = vid
                            res.redirect('/')
                        }
                    })            
            
                };
            }
        }
    })
});


//VALIDATION of signup
app.post("/signup", (req,res) =>{
    if(req.body.password != req.body.password2){
        console.log(err)
        return res.send({
            success: false,
            statusCode: 400
        })
    }
    else{
        var salt = bcrypt.genSaltSync(10);
        var hashed_password = bcrypt.hashSync(req.body.password, salt);

        let sqlQuery ={
            text: `CALL register($1,$2,$3,$4,$5,$6,$7,$8, null)`,
            values: [req.body.username, hashed_password, req.body.email, req.body.fname, null, req.body.lName, req.body.bday, req.body.phone_num]
        }
        client.query(`SET SCHEMA 'public'`)
        client.query(sqlQuery, (err, result) =>{
            let {vaccount_id} = result.rows[0]

            if(err){
                console.log(err)
                return res.send({
                    success: false,
                    statusCode: 400
                })
            }
            else if(vaccount_id != null){ // IF NOT NULL THEN SUCCESS
                console.log(vaccount_id)
                console.log('SUCCESS') 
                return res.redirect('/')
                
            }
            else{
                console.log('ACCOUNT EXISTS') // IF NULL THEN EXISTING
                console.log(vaccount_id)
                return res.send({
                    success: 'ACCOUNT EXISTS',
                    statusCode: 200,
                })
            }
        })
    }
});

//PAGE of items
app.get("/items", (req,res) =>{
    var user = req.session.username
    var cart_count = req.session.cart_count
    var currency = req.session.currency
    console.log('succ1')

    client.query('SELECT * FROM "public".item', (error, rows) => {
        if(error){
            console.log('error1')
        }
        else if(!error){
            res.render('pages/item-page', { result:rows.rows, user, cart_count, currency })
        }
    });
});

//add to cart button
app.post("/items", (req,res) =>{
    var user = req.session.username
    var item_id = req.body.addtocart
    message = 0

    if(!user){
        res.redirect('/')
    }
    if(user){
        client.query(`SELECT item_id FROM "public".cart WHERE username = '${user}' AND item_id = ${item_id}`, (error, rows) => {
            if(error){
                console.log('error')
            }
            else if(!error){
                if(rows.length){
                    console.log('Item is already in the cart!')
                    
                    res.redirect('/items')
                }
                else if(rows.length == 0){
                    client.query(`INSERT INTO "public".cart VALUES('${user}', '${item_id}', 1) `, (error, rows) => {
                        if(error){
                            console.log('error')
                        }
                        else if(!error){
                            req.session.cart_count += 1
                            res.redirect('/items')
                        }
                    });
                }
            }
        });
    }
})

//VIEWING of a specific item
app.get("/items/view/:id", (req,res) =>{

    var sqlQuery = {
        text: `SELECT * FROM view_item($1)`, //item id ang hinahanap
        values:[req.params.id] 
    }

    var sqlQuery2 = {
        text: `SELECT * FROM check_available($1)`, //item id ang hanap
        values: [req.params.id]
    }

    client.query(sqlQuery, (error, result) => {
        if(error){
            res.send(error)
        }
        else if(!error){
            let {item_id, account_id, item_quantity, 
                item_name, item_category, item_description, rental_rate, 
                replacementm, cost, date_posted, image_path} = result.rows[0]
                
                console.log('good item query 1')

            if(item_id == null){ // DATABASE RETURNS vinventory_id NULL 
                return res.send('Item does not Exist!')
            }

            else if(item_id != null){ // IF ACCOUNT DOES EXIST
                client.query(sqlQuery2, (error, dates) => {
                    if(error){
                        res.send(error)
                    }
                    else if(!error){
                        console.log('good item query 2')
                        console.log(dates.rows)                        
                        res.render('pages/view-item', { result, user:req.session.user, result_date:dates.rows, cart_count:req.session.cart_count })
                    }
                })

                
            }
        }
    })
})

//availability(reservation calendar)
app.post("/items/view/:id", (req,res) =>{
    var daterange = req.body.daterange
    var startDate
    var endDate
    [startDate, endDate] = daterange.split(' - ');
    console.log(`${startDate}-${endDate}`)
});

app.post('/items/view/:id/reserve', (req, res)=>{
    var item_id = req.params.id
    var inventory_id

    var invIdQuery = {
        text: `SELECT inventory_id FROM inventory WHERE item_id = ${item_id}`
    }  
    

    client.query(`SET SCHEMA 'public'`)

    client.query(invIdQuery, (error, result) =>{
        if(error){
            console.log(error)
            res.send(error)
        }
        else if(!error){
            console.log('good reservation query1')
            let {inventory_id} = result.rows[0]

            var sqlQuery = {
                text: `CALL check_reservation($1, $2, $3, $4)`, // <-- INSERT STATEMENT STORED PROC
                values: [inventory_id, req.session.user_id, req.body.start_date, req.body.end_date]
            }
            
            client.query(sqlQuery, (error, result) => {
                if(error){
                    console.log('error2')
                    res.send(error)
                }
                else if(!error){
                    console.log('good reservation query2')
                    let {vinventory_id} = result.rows[0]
        
                    if(vinventory_id == null){ // DATABASE RETURNS vinventory_id NULL 
                        return res.send('Item is already reserved!')
                    }
        
                    else if(vinventory_id != null){ // IF ACCOUNT DOES EXIST
                        return res.redirect(`/items`)
                    }
                }
            })
        }
    })
})

//VIEW profile
app.get("/profile/:username", (req,res) =>{

    var username = req.params.username
    client.query(`SET SCHEMA 'test'`)

    client.query(`SELECT * FROM seller_info WHERE seller_user = '${username}'`, (error, rows) => {
        if(error){
            // res.status(404)
        }
        else if(!error){
            res.render('pages/user-profile', {rows})
        }
    });
});

app.get("/sendmail", (req,res) => {
    async function main() {

        // create reusable transporter object using the default SMTP transport
        let transporter = nodemailer.createTransport({
            host: "smtp.sendgrid.net",
            port: 465,
            auth: {
                user: process.env.NM_USERNAME,
                pass: process.env.NM_PASSWORD
          },
        });
      
        // send mail with defined transport object
        let info = await transporter.sendMail({
          from: '"Naedenglee" <naedenglee.capstone@gmail.com>', // sender address
          to: "artaberdo@gmail.com", // list of receivers
          subject: "TEST SENDGRID", // Subject line
          text: "pak uuuu galing node tooo", // plain text body
          html: "<b>pak uuuu galing node tooo</b><br><button>Login</button>", // html body
        });
      
        console.log("Message sent: %s", info.messageId);
        // Message sent: <b658f8ca-6296-ccf4-8306-87d57a0b4321@example.com>
      
        // Preview only available when sending through an Ethereal account
        console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
        // Preview URL: https://ethereal.email/message/WaQKMgKddxQDoou...
      }
      
      main().catch(console.error);
});

app.get("/emailform", (req,res) => {
    console.log(process.env.NM_PASSWORD)
    res.render('pages/try_emailform')
    
});

app.post("/emailform", (req,res) => {
    var email = req.body.email
    var otp = otpGenerator.generate(6, { upperCaseAlphabets: true, specialChars: false });
    req.session.emailotp = otp
    
    async function main() {

        // create reusable transporter object using the default SMTP transport
        let transporter = nodemailer.createTransport({
            host: "smtp.sendgrid.net",
            port: 465,
            auth: {
                user: process.env.NM_USERNAME,
                pass: process.env.NM_PASSWORD
          },
        });
      
        // send mail with defined transport object
        let info = await transporter.sendMail({
          from: '"Naedenglee" <naedenglee.capstone@gmail.com>', // sender address
          to: `${email}`, // list of receivers
          subject: "EMAIL OTP - Mang-Hiram", // Subject line
          text: "Hello Nae", // plain text body
          html: `<body style="font-family: Helvetica, Arial, sans-serif; margin: 0px; padding: 0px; background-color: #ffffff;">
          <table role="presentation"
            style="width: 100%; border-collapse: collapse; border: 0px; border-spacing: 0px; font-family: Arial, Helvetica, sans-serif; background-color: rgb(239, 239, 239);">
            <tbody>
              <tr>
                <td align="center" style="padding: 1rem 2rem; vertical-align: top; width: 100%;">
                  <table role="presentation" style="max-width: 600px; border-collapse: collapse; border: 0px; border-spacing: 0px; text-align: left;">
                    <tbody>
                      <tr>
                        <td style="padding: 40px 0px 0px;">
                          <div style="text-align: left;">
                            <div style="padding-bottom: 20px;"><img src="https://iili.io/HHBnlLb.md.png" alt="Company" style="width: 56px;"></div>
                          </div>
                          <div style="padding: 20px; background-color: rgb(255, 255, 255);">
                            <div style="color: rgb(0, 0, 0); text-align: left;">
                              <h1 style="margin: 1rem 0">One-Time Password(OTP)</h1>
                              <p style="padding-bottom: 16px">Please use the OTP code below to verify your account.</p>
                              <p style="padding-bottom: 16px"><strong style="font-size: 130%">${req.session.emailotp}</strong></p>
                              <p style="padding-bottom: 16px">If you did not request this, you can ignore this email.</p>
                              <p style="padding-bottom: 16px">Thanks,<br>Mang-Hiram</p>
                            </div>
                          </div>
                          <div style="padding-top: 20px; color: rgb(153, 153, 153); text-align: center;">
                            <p style="padding-bottom: 16px">This is an automated message. Please do not reply.</p>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            </tbody>
          </table>
        </body>`, // html body
        });
      
        console.log("Message sent: %s", info.messageId);
        res.render('pages/try_validateemail', { email })
      }
      
      main().catch(console.error);


});

app.post("/validate_email", (req,res) => {
    var otp = req.body.otp

    if(otp == req.session.emailotp){
        console.log('OTP matched!')
        var sqlQuery = {
            text: `UPDATE "public".profile SET is_verified = 1 WHERE account_id = $1`,
            values: [req.session.user_id]
        }
        client.query(sqlQuery, (error, result) =>{
            if(error){
                res.send(error)
            }
            else if(!error){
                res.redirect('/item/listing')
            }
        })
        req.session.otp = null
    }
    else if(otp != req.session.emailotp){
        console.log('error')
        res.send('error')
    }
});

app.get("/cart", (req,res) =>{
    var user_id = req.session.user_id
    var user = req.session.username

    var sqlQuery = {
        text: `SELECT a.cart_id, a.item_id, a.qty,b.item_name, b.rental_rate, b.image_path, b.item_description 
                FROM "public".cart a LEFT JOIN "public".item b ON a.item_id = b.item_id WHERE account_id = $1`,
        values: [user_id]
    }

    client.query(sqlQuery, (error, result) =>{
        if(error){
            res.send(error)
        }
        else if(!error){
            res.render('pages/cart', { user, result:result.rows, cart_count:req.session.cart_count, currency:req.session.currency })
        }
    })
});

app.post("/cart/remove/:cart_id", (req,res) =>{

    var sqlQuery = {
        text: `DELETE FROM "public".cart WHERE cart_id = $1`,
        values: [req.params.cart_id]
    }

    client.query(sqlQuery, (error, result) =>{
        if(error){
            res.send(error)
        }
        else if(!error){
            req.session.cart_count = req.session.cart_count - 1
            res.redirect('/cart')
        }
    })
});

app.get("/dashboard", (req,res) => {
    res.render('pages/dashboard_main')
})

app.get("/dashboard/user/rentals/ongoing", (req,res) => {
    res.render('pages/dashboard_user_rentals_ongoing')
})

app.get("/dashboard/seller/requests", (req,res) => {
    res.render('pages/dashboard_requests')
})

app.get("/dashboard/seller/requests/approved", (req,res) => {
    res.render('pages/dashboard_requests_approved')
})

app.get("/dashboard/seller/requests/denied", (req,res) => {
    res.render('pages/dashboard_requests_denied')
})

app.get("/item/listing", (req,res) => {
    var sqlQuery = { 
        text: `SELECT email, is_verified FROM public.profile a JOIN public.account b ON a.account_id = b.account_id WHERE a.account_id = $1`,
        values: [            
            req.session.user_id
        ]
    }

    client.query(sqlQuery, (error, result) => {
        if(error){
            console.log(error)
            res.send(error)
        }
        else if(!error){
            if(result.rows[0].is_verified == 0){
                var email = result.rows[0].email
                var otp = otpGenerator.generate(6, { upperCaseAlphabets: true, specialChars: false });
                req.session.emailotp = otp
                
                async function main() {

                    // create reusable transporter object using the default SMTP transport
                    let transporter = nodemailer.createTransport({
                        host: "smtp.sendgrid.net",
                        port: 465,
                        auth: {
                            user: process.env.NM_USERNAME,
                            pass: process.env.NM_PASSWORD
                    },
                    });
                
                    // send mail with defined transport object
                    let info = await transporter.sendMail({
                    from: '"Naedenglee" <naedenglee.capstone@gmail.com>', // sender address
                    to: `${email}`, // list of receivers
                    subject: "EMAIL OTP - Mang-Hiram", // Subject line
                    text: "Hello Nae", // plain text body
                    html: `<body style="font-family: Helvetica, Arial, sans-serif; margin: 0px; padding: 0px; background-color: #ffffff;">
                    <table role="presentation"
                        style="width: 100%; border-collapse: collapse; border: 0px; border-spacing: 0px; font-family: Arial, Helvetica, sans-serif; background-color: rgb(239, 239, 239);">
                        <tbody>
                        <tr>
                            <td align="center" style="padding: 1rem 2rem; vertical-align: top; width: 100%;">
                            <table role="presentation" style="max-width: 600px; border-collapse: collapse; border: 0px; border-spacing: 0px; text-align: left;">
                                <tbody>
                                <tr>
                                    <td style="padding: 40px 0px 0px;">
                                    <div style="text-align: left;">
                                        <div style="padding-bottom: 20px;"><img src="https://iili.io/HHBnlLb.md.png" alt="Company" style="width: 56px;"></div>
                                    </div>
                                    <div style="padding: 20px; background-color: rgb(255, 255, 255);">
                                        <div style="color: rgb(0, 0, 0); text-align: left;">
                                        <h1 style="margin: 1rem 0">One-Time Password(OTP)</h1>
                                        <p style="padding-bottom: 16px">Please use the OTP code below to verify your account.</p>
                                        <p style="padding-bottom: 16px"><strong style="font-size: 130%">${req.session.emailotp}</strong></p>
                                        <p style="padding-bottom: 16px">If you did not request this, you can ignore this email.</p>
                                        <p style="padding-bottom: 16px">Thanks,<br>Mang-Hiram</p>
                                        </div>
                                    </div>
                                    <div style="padding-top: 20px; color: rgb(153, 153, 153); text-align: center;">
                                        <p style="padding-bottom: 16px">This is an automated message. Please do not reply.</p>
                                    </div>
                                    </td>
                                </tr>
                                </tbody>
                            </table>
                            </td>
                        </tr>
                        </tbody>
                    </table>
                    </body>`, // html body
                    });
                
                    console.log("Message sent: %s", info.messageId);
                    res.render('pages/try_validateemail', { email })
                }
                
                main().catch(console.error);
            }
            else if(result.rows[0].is_verified == 1){
                res.render('pages/item_list')
            }
        }
    })



    
})

app.post("/item/listing", async(req,res) => {   
    //cloudinary upload function 
    const uploadImage = async (imagePath) => {

        // Use the uploaded file's name as the asset's public ID and 
        // allow overwriting the asset with new versions
        const options = {
            use_filename: true,
            unique_filename: false,
            overwrite: true,
            folder:'mang-hiram-seller-pictures'
        };
    
        try {
            // Upload the image
            const result = await cloudinary.uploader.upload(imagePath, options);
            console.log(result);
            return result.secure_url;
        } catch (error) {
            console.error(error);
        }
    };

    const imagePath = req.body.imageFileb64;

    // Upload the image
    const imageUrl = await uploadImage(imagePath);
    console.log(imageUrl)

    var sqlQuery = { 
        text: `CALL item_insert($1, $2, $3, $4, $5, $6, $7, $8, NULL)`,
        values: [
            req.body.item_name, //HTML
            req.body.category,
            req.body.description, 
            req.body.rental_rate, 
            req.body.replacement_cost,
            imageUrl,
            req.body.quantity,
            req.session.user_id
        ]
    }

    client.query(`SET SCHEMA 'public'`)
    client.query(sqlQuery, (error, result) => {
        if(error){
            console.log(error)
            res.send(error)
        }
        else if(!error){            

            if(result.rows[0].is_verified == 0){ // DATABASE RETURNS vinventory_id NULL 
                return res.send('Conflict Query')
            }

            else if(vitem_id != null){ // IF ACCOUNT DOES EXIST
                return res.send('Success!')
            }
        }
    })
})

//logout
app.get('/logout',function(req,res){
    req.session = null
    res.redirect('/')
});
