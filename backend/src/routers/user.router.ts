import {Router} from 'express';
import { sample_users } from '../data/users';
import jwt from 'jsonwebtoken';
import asyncHandler from 'express-async-handler';
import { User, UserModel } from '../models/user.model';
import { HTTP_BAD_REQUEST } from '../constants/http_status';
import bcrypt from 'bcryptjs';
import authMid from '../middlewares/auth.mid';
const router = Router();

router.get("/seed", asyncHandler(
  async (req, res) => {
     const usersCount = await UserModel.countDocuments();
     if(usersCount > 0 && req.query.force !== 'true'){
       res.send("Seed is already done! Add ?force=true to reset the sample users.");
       return;
     }

     // remove old sample users and recreate them with HASHED passwords,
     // so login (bcrypt.compare) works for the seeded accounts.
     await UserModel.deleteMany({ email: { $in: sample_users.map((u:any) => u.email.toLowerCase()) } });

     const hashedUsers = await Promise.all(
       sample_users.map(async (u:any) => ({
         ...u,
         email: u.email.toLowerCase(),
         password: await bcrypt.hash(u.password, 10),
       }))
     );

     await UserModel.create(hashedUsers);
     res.send("Seed Is Done!");
 }
 ))

router.post("/login", asyncHandler(
  async (req, res) => {
    const {email, password} = req.body;
    const user = await UserModel.findOne({email});
  
     if(user && (await bcrypt.compare(password,user.password))) {
      res.send(generateTokenReponse(user));
     }
     else{
       res.status(HTTP_BAD_REQUEST).send("Username or password is invalid!");
     }
  
  }
))
  
router.post('/register', asyncHandler(
  async (req, res) => {
    const {name, email, password, address} = req.body;
    const user = await UserModel.findOne({email});
    if(user){
      res.status(HTTP_BAD_REQUEST)
      .send('User is already exist, please login!');
      return;
    }

    const encryptedPassword = await bcrypt.hash(password, 10);

    const newUser:User = {
      id:'',
      name,
      email: email.toLowerCase(),
      password: encryptedPassword,
      address,
      isAdmin: false
    }

    const dbUser = await UserModel.create(newUser);
    res.send(generateTokenReponse(dbUser));
  }
))

// DEV HELPER: promote a user to admin by email. Remove before production.
router.get('/makeAdmin/:email', asyncHandler(
  async (req, res) => {
    const user = await UserModel.findOneAndUpdate(
      { email: req.params.email.toLowerCase() },
      { isAdmin: true },
      { new: true }
    );
    if (!user) {
      res.status(HTTP_BAD_REQUEST).send('User not found! Check the email.');
      return;
    }
    res.send(`${user.email} is now an admin. Please log out and log back in to refresh your access.`);
  }
))

// DEV HELPER: delete a user by email (open in browser). Remove before production.
router.get('/delete/:email', asyncHandler(
  async (req, res) => {
    const result = await UserModel.deleteOne({ email: req.params.email.toLowerCase() });
    if (result.deletedCount === 0) {
      res.status(HTTP_BAD_REQUEST).send('User not found! Check the email.');
      return;
    }
    res.send(`Deleted user: ${req.params.email.toLowerCase()}`);
  }
))

// DEV HELPER: reset a user's password by email (it gets bcrypt-hashed).
// Open in browser:  /api/users/setPassword/EMAIL/NEWPASSWORD
// Remove before production.
router.get('/setPassword/:email/:newPassword', asyncHandler(
  async (req, res) => {
    const hashed = await bcrypt.hash(req.params.newPassword, 10);
    const user = await UserModel.findOneAndUpdate(
      { email: req.params.email.toLowerCase() },
      { password: hashed },
      { new: true }
    );
    if (!user) {
      res.status(HTTP_BAD_REQUEST).send('User not found! Check the email.');
      return;
    }
    res.send(`Password reset for ${user.email}. You can now log in with the new password.`);
  }
))

// DEV HELPER: list all users (open in browser). Shows name/email/admin, no passwords.
router.get('/list', asyncHandler(
  async (req, res) => {
    const users = await UserModel.find({}, 'name email isAdmin');
    res.send(users);
  }
))

router.put('/updateProfile', authMid, asyncHandler(
  async (req: any, res) => {
    const { name, email } = req.body;

    const taken = await UserModel.findOne({
      email: email.toLowerCase(),
      _id: { $ne: req.user.id },
    });
    if (taken) {
      res.status(HTTP_BAD_REQUEST).send('Email is already in use by another account!');
      return;
    }

    const user = await UserModel.findByIdAndUpdate(
      req.user.id,
      { name, email: email.toLowerCase() },
      { new: true }
    );
    res.send(generateTokenReponse(user!));
  }
))

router.put('/changePassword', authMid, asyncHandler(
  async (req: any, res) => {
    const { currentPassword, newPassword } = req.body;

    const user = await UserModel.findById(req.user.id);
    if (!user) {
      res.status(HTTP_BAD_REQUEST).send('Change Password Failed!');
      return;
    }

    const equal = await bcrypt.compare(currentPassword, user.password);
    if (!equal) {
      res.status(HTTP_BAD_REQUEST).send('Current password is not correct!');
      return;
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    res.send('Password changed successfully!');
  }
))

  const generateTokenReponse = (user : User) => {
    const token = jwt.sign({
      id: user.id, email:user.email, isAdmin: user.isAdmin
    },process.env.JWT_SECRET!,{
      expiresIn:"30d"
    });
  
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      address: user.address,
      isAdmin: user.isAdmin,
      token: token
    };
  }
  

  export default router;
