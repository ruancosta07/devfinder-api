import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import prisma from "../utils/prisma.ts";
const jwtKey = process.env.JWT_KEY as string;

type Token = {
  name: string;
  email: string;
  role: string;
};

const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { authorization } = req.headers;
    if (!authorization) {
      res.status(401).json({
        message: "Usuário(a) não possui permissão para realizar essa ação",
      });
      return;
    }
    const [, token] = authorization.split(" ") as string[];
    if (!token) {
      res.status(401).json({
        message: "Usuário(a) não possui permissão para realizar essa ação",
      });
      return;
    }
    const decodedToken = jwt.verify(token, jwtKey) as Token;
    const userExists = await prisma.users.findFirst({
      where: {
        email: decodedToken.email,
      },
    });
    if (!userExists) {
      res.status(401).json({
        message: "Usuário(a) não possui permissão para realizar essa ação",
      });
      return;
    }
    next();
  } catch (err) {
    res
      .status(401)
      .json({
        message: "Usuário(a) não possui permissão para realizar essa ação",
      });
    return;
  }
};
const recruiterMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { authorization } = req.headers;
    if (!authorization) {
      res.status(401).json({
        message: "Usuário(a) não possui permissão para realizar essa ação",
      });
      return;
    }
    const [, token] = authorization.split(" ") as string[];
    if (!token) {
      res.status(401).json({
        message: "Usuário(a) não possui permissão para realizar essa ação",
      });
      return;
    }
    const decodedToken = jwt.verify(token, jwtKey) as Token;
    const userExists = await prisma.users.findFirst({
      where: {
        email: decodedToken.email,
      },
    });
    if (!userExists || userExists.role !== "Recrutador") {
      res.status(401).json({
        message: "Usuário(a) não possui permissão para realizar essa ação",
      });
      return;
    }
    next();
  } catch (err) {
    res
      .status(401)
      .json({
        message: "Usuário(a) não possui permissão para realizar essa ação",
      });
    return;
  }
};

export {authMiddleware, recruiterMiddleware}