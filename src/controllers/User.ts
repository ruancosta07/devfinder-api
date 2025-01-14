import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { Request, Response } from "express";
import { z } from "zod";
import prisma from "../utils/prisma.ts";
import nodemailer from "../utils/nodemailer.ts";
import emailToSend from "../utils/email.ts";
import supabase from "../utils/supabase.ts";
import { v7 as uuid } from "uuid";

const jwtKey = process.env.JWT_KEY as string;
import sharp from "sharp";

interface UserBody {
  name: string;
  email: string;
  password: string;
  role: "Candidato" | "Recrutador";
}

// * Controller de criação de usuário
// ? POST
const createUser = async (req: Request, res: Response) => {
  try {
    const userSchema = z.object({
      name: z
        .string({ message: "O nome é obrigatório" })
        .min(4, { message: "O nome deve ter no mínimo 4 caracteres." }),
      email: z
        .string({ message: "O email é obrigatório" })
        .email({ message: "Insira um email válido." }),
      password: z
        .string({ message: "A senha é obrigatória" })
        .regex(/^(?=.*[A-Z]).{8,}$/, {
          message:
            "A senha deve ter no mínimo 8 caracteres e uma letra maiúscula."
        }),
      role: z.string({ message: "O usuário deve ter um tipo de perfil." })
    });

    const { name, email, password, role }: UserBody = req.body;
    userSchema.parse({ name, email, password, role });
    const userAlreadyExists = await prisma.users.findFirst({
      where: {
        email
      }
    });

    if (userAlreadyExists) {
      res.status(401).json({ message: "Email já cadastrado" });
      return;
    }

    const hashPassword = await bcrypt.hash(password, 12);

    const newUser = await prisma.users.create({
      data: {
        email,
        name,
        password: hashPassword,
        role
      },
      select: {
        email: true,
        name: true,
        role: true,
        id: true
      }
    });

    const token = jwt.sign(
      {
        name: newUser.name,
        email: newUser.email,
        role: newUser.role
      },
      jwtKey,
      { algorithm: "HS512", expiresIn: "7d" }
    );
    res
      .status(201)
      .json({ message: "Usuário criado com sucesso", user: newUser, token });
    return;
  } catch (err) {
    if (err instanceof z.ZodError) {
      console.log(err.errors);
      res.status(400).json(
        err.errors.map((e) => ({
          type: "Campo inválido",
          field: e.path[0],
          message: `Erro, ${e.message}`
        }))
      );
      return;
    }
    res.status(500).json({ message: "Erro interno do servidor" });
    return;
  }
};

// * Controller de login
// ? POST
const login = async (req: Request, res: Response) => {
  try {
    const { email, password }: { email: string; password: string } = req.body;
    const foundUser = await prisma.users.findFirst({
      where: {
        email
      }
    });
    if (!foundUser) {
      res.status(400).json({ message: "Email ou senha incorretos" });
      return;
    }
    const passwordMatch = await bcrypt.compare(password, foundUser.password);
    if (!passwordMatch) {
      res.status(400).json({ message: "Email ou senha incorretos" });
      return;
    }

    const token = jwt.sign(
      {
        email: foundUser.email,
        name: foundUser.name,
        role: foundUser.role
      },
      jwtKey,
      { algorithm: "HS512", expiresIn: "7d" }
    );

    if (!foundUser.twoStepsAuth) {
      res.status(200).json({
        message: "Login realizado com sucesso",
        user: {
          id: foundUser.id,
          email: foundUser.email,
          name: foundUser.name,
          avatar: foundUser.avatar
        },
        token,
        twoStepsAuth: foundUser.twoStepsAuth
      });
      return;
    }
    if (foundUser.twoStepsAuth) {
      const uuid = crypto.randomUUID();
      const twoStepsCode = uuid
        .split("-")
        [uuid.split("-").length - 1].toUpperCase()
        .slice(0, 6);
      const dateTime = Date.now();
      const expiresAtDate = dateTime + 15 * 60 * 1000;
      await Promise.allSettled([
        nodemailer.sendMail({
          from: "Ruan Costa - Devfinder",
          to: foundUser.email,
          subject: "Código de verificação de duas etapas",
          html: emailToSend({ code: twoStepsCode })
        }),
        prisma.users.update({
          where: {
            id: foundUser.id
          },
          data: {
            twoStepsCode: twoStepsCode,
            twoStepsCodeExpiresAt: expiresAtDate
          }
        })
      ]);
      res.status(202).json({
        message: "Código enviado com sucesso",
        twoStepsAuth: foundUser.twoStepsAuth
      });
      return;
    }
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Erro interno do servidor" });
    return;
  }
};

// * Controller de confirmação do código enviado
// ? POST
const confirmCode = async (req: Request, res: Response) => {
  try {
    const { code, email }: { code: string; email: string } = req.body;
    const foundUser = await prisma.users.findFirst({
      where: {
        email
      }
    });
    if (!foundUser) {
      res.status(401).json({ message: "Email ou senha incorretos" });
      return;
    }
    const datetime = Date.now();
    if ((foundUser.twoStepsCodeExpiresAt as number) > datetime) {
      res.status(400).json({ message: "O código fornecido expirou" });
      return;
    }
    if (code !== (foundUser.twoStepsCode as string)) {
      res.status(400).json({ message: "O código fornecido está incorreto" });
      return;
    }
    res.status(200).json({
      message: "Login realizado com sucesso",
      user: {
        id: foundUser.id,
        email: foundUser.email,
        name: foundUser.name,
        avatar: foundUser.avatar
      }
    });
    return;
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Erro interno do servidor" });
    return;
  }
};

// * Controller de verificação do token enviado
// ? POST
const verifyToken = async (req: Request, res: Response) => {
  try {
    const { authorization } = req.headers;
    if (!authorization) {
      res.status(401).json({
        message: "Usuário(a) não possui permissão para realizar essa ação."
      });
      return;
    }
    const [, token] = authorization.split(" ") as string[];
    if (!token) {
      res.status(401).json({
        message: "Usuário(a) não possui permissão para realizar essa ação."
      });
      return;
    }
    const decodedToken = jwt.verify(token, jwtKey) as {
      email: string;
      id: string;
      name: string;
      role: string;
    };
    const userExists = await prisma.users.findUnique({
      where: {
        id: decodedToken.id
      }
    });
    if (!userExists) {
      res.status(401).json({
        message: "Usuário(a) não possui permissão para realizar essa ação."
      });
      return;
    }
    res.status(200).json();
    return;
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Erro interno do servidor" });
    return;
  }
};

// * Controller de exclusão da conta do usuário
// ? DELETE
const deleteAccount = async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const foundUser = await prisma.users.findUnique({ where: { id } });
    if (foundUser) {
      prisma.users.delete({
        where: {
          id
        }
      });
    }
    res.status(201).json({ message: "Usuário excluído com sucesso" });
    return;
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Erro interno do servidor" });
    return;
  }
};

// * Controller de criação de projetos para o portfólio
// ? POST
const uploadProject = async (req: Request, res: Response) => {
  try {
    let images = req.files;
    let imagesUploaded = [] as { name: string; url: string; type: string }[];
    const { userId } = req.params as { userId: string };
    if (images && Array.isArray(images)) {
      for (const image of images) {
        // Formatação do nome da imagem para formato webp
        const imageName =
          image.originalname
            .split(".")
            .slice(0, image.originalname.split(".").length - 1)
            .join(".") + ".webp";
        const uniqueImage = `${userId}-${Date.now()}-${imageName}`;
        const optimizedImage = await sharp(image.buffer)
          .webp({ quality: 75 })
          .toBuffer();
        const { error } = await supabase.storage
          .from("utilsBucket")
          .upload(uniqueImage, optimizedImage, {
            contentType: "image/webp",
            upsert: false
          });
        if (error) {
          res.status(500).json({ message: "Erro ao enviar as imagens" });
          return;
        }
        const { publicUrl } = supabase.storage
          .from("utilsBucket")
          .getPublicUrl(uniqueImage).data;
        imagesUploaded.push({
          name: imageName,
          url: publicUrl,
          type: "image/webp"
        });
      }
    }
    const projectSchema = z.object({
      title: z.string({ message: "O título do projeto é obrigatório" }),
      description: z
        .string()
        .max(2000, {
          message: "A descrição deve ter no máximo 2000 caracteres"
        }),
      stack: z.string().array().nullable(),
      repository: z
        .string()
        .url({ message: "Insira uma URL válida" })
        .optional(),
      link: z
        .string({
          message: "O projeto deve possuir um link para ser acessado."
        })
        .url({ message: "Insira uma URL válida" })
    });
    const {
      title,
      description,
      stack,
      repository,
      link
    }: {
      title: string;
      description: string;
      stack: string[];
      repository: string;
      link: string;
    } = req.body;
    projectSchema.parse({ title, description, stack, repository, link });
    const foundUser = await prisma.users.findUnique({
      where: { id: userId }
    });
    if (!foundUser) {
      res.status(401).json({
        message: "Usuário não possui permissão para criar um projeto"
      });
      return;
    }
    await prisma.projects.create({
      data: {
        title,
        description,
        link,
        stack,
        repository,
        images: imagesUploaded.map((i) => i.url),
        userId
      }
    });
    res.status(201).json({ message: "Projeto criado com sucesso" });
    return;
  } catch (err) {
    if (err instanceof z.ZodError) {
      res
        .status(500)
        .json(
          err.errors.map((e) => ({
            message: "Erro de validação",
            field: e.path[0],
            error: e.message
          }))
        );
      return;
    }
    console.log(err);
    return;
  }
};

// * Controller de exibição dos projetos
// ? GET
const getProjects = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params as { userId: string };
    const projects = await prisma.projects.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" }
    });
    res
      .status(200)
      .json({ message: "Projetos carregados com sucesso", projects });
    return;
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Erro interno do servidor" });
    return;
  }
};

// * Controller de edição de um projeto
// ? PUT
const editProject = async (req: Request, res: Response) => {
  try {
    const { id, userId } = req.params as { id: string; userId: string };
    const project = await prisma.projects.findFirst({ where: { AND: [{ id }, { userId }] } });
    const {
      title,
      description,
      stack,
      images,
      repository,
      link
    } = req.body as {
      title: string;
      description: string,
      stack: string[],
      repository: string,
      link: string,
      images: string[]
    };
    if (!project) {
      res.status(401).json({ message: "O usuário não possui permissão para realizar essa ação" });
      return;
    }
    const projectSchema = z.object({
      title: z.string({ message: "O título do projeto é obrigatório" }),
      description: z
        .string()
        .max(2000, {
          message: "A descrição deve ter no máximo 2000 caracteres"
        }),
      stack: z.string().array().nullable(),
      repository: z
        .string()
        .url({ message: "Insira uma URL válida" })
        .optional(),
      link: z
        .string({
          message: "O projeto deve possuir um link para ser acessado."
        })
        .url({ message: "Insira uma URL válida" })
    });
    projectSchema.parse({ title, description, stack, repository, link, images });

  } catch (e) {
    if (e instanceof z.ZodError) {
      console.error(e.errors.map((e) => ({ message: "Erro de validação", field: e.path[0], error: e.message })));
      return;
    }
  }
};

// * Controller de edição de dados do usuário
// ? PUT

const editUser = async (req: Request, res: Response) => {
  try {
    interface User {
      name: string;
      email: string;
      resume: string;
      skills: string[];
      stack: string[];
    }

    const { id } = req.params as { id: string };
    const { name, email, resume, skills, stack } = req.body as User;
    const userSchema = z.object({
      name: z.string({ message: "O nome não pode ficar em branco" }).optional(),
      email: z.string({ message: "O email não pode ficar em branco" }).email({ message: "Digite um email válido." }).optional(),
      resume: z.string().optional(),
      skills: z.string().array().optional(),
      stack: z.string().array().optional()
    });
    userSchema.parse({ name, email, resume, skills, stack });

    const foundUser = await prisma.users.findUnique({
      where: { id }, select: {
        name: true,
        email: true,
        resume: true,
        skills: true,
        stack: true
      }
    });
    if (!foundUser) {
      res.status(401).json({ message: "O usuário não possui permissão para realizar essa ação." });
      return;
    }


    await prisma.users.update({
      where: {
        id
      },
      data: {
        name: name ?? foundUser.name,
        email: email ?? foundUser.email,
        resume: resume ?? foundUser.resume,
        skills: skills ?? foundUser.skills,
        stack: stack ?? foundUser.stack
      }
    });
    res.status(202).json({ message: "Usuário editado com sucesso" });
    return;
  } catch (err) {
    if (err instanceof z.ZodError) {
      console.log(err.errors.map(e => ({ field: e.path[0], message: e.message })));
      res.status(400).json(err.errors.map(e => ({ field: e.path[0], message: e.message })));
      return;
    }
    console.log(err);
    res.status(500).json({ message: "Erro interno do servidor" });
    return;
  }
};

export {
  createUser,
  login,
  confirmCode,
  verifyToken,
  deleteAccount,
  uploadProject,
  getProjects,
  editUser
};
