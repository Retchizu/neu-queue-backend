import { Request, Response } from "express";

export const getCurrentAuthDetails = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({ message: "Unauthorized request" });
            return;
        }

        res.status(200).json({ user: req.user });
    } catch (error) {
        res.status(500).json({
            message: `Server error: ${(error as Error).message}`,
        });
    }
};
