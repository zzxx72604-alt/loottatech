import { HTTP_UNAUTHORIZED } from "../constants/http_status";

export default (req: any, res: any, next: any) => {
    if (req.user && req.user.isAdmin) {
        return next();
    }
    res.status(HTTP_UNAUTHORIZED).send();
}
