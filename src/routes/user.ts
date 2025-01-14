import { Router } from "express";
import {
  confirmCode,
  createUser,
  deleteAccount,
  getProjects,
  login,
  uploadProject,
  verifyToken
} from "../controllers/User.ts";
import upload from "../utils/multer.ts";
import { authMiddleware } from "../middlewares/authMiddleware.ts";
const userRoutes = Router()

userRoutes.post("/criar-conta", createUser)
userRoutes.post("/login", login)
userRoutes.post("/:userId/criar-projeto", authMiddleware, upload.array("images"),  uploadProject)
userRoutes.post("/confirmar-codigo",  confirmCode)
userRoutes.post("/verificar-conta", verifyToken);
userRoutes.get("/:id/carregar-projetos", authMiddleware, getProjects);
userRoutes.delete("/:id/excluir-conta",authMiddleware, deleteAccount);

export default userRoutes