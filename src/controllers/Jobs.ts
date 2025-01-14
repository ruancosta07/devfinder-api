import { Response, Request } from "express";
import prisma from "../utils/prisma";
import { z } from "zod";

const applyToJob = async (req: Request, res: Response) => {
  try {
    const { opportunityId } = req.params;
    const { userId }: { userId: string } = req.body;
    await prisma.opportunities.update({
      where: {
        id: opportunityId,
      },
      data: {
        userId,
      },
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Erro interno do servidor" });
    return;
  }
};

const createJob = async (req: Request, res: Response) => {
  try {
    const jobSchema = z.object({
      title: z.string({ message: "O título da vaga é obrigatório." }).min(8),
      description: z
        .string({ message: "A descrição da vaga é obrigatório." })
        .min(100),
      salary: z.number({ message: "O salário da vaga é obrigatório" }),
      mode: z.string({ message: "A modalidade da vaga é obrigatório" }),
      type: z.string(),
      remote: z.string(),
      stack: z.string().array().nullable(),
      benefits: z.string().array().nullable(),
      skills: z.string().array().nullable(),
      recruiterId: z.string(),
    });

    const {
      title,
      description,
      salary,
      mode,
      type,
      remote,
      stack,
      benefits,
      skills,
      recruiterId,
    }: {
      title: string;
      description: string;
      salary: string;
      mode: string;
      type: string;
      remote: string;
      stack: string[];
      benefits: string[];
      skills: string[];
      recruiterId: string;
    } = req.body;
    const foundUser = await prisma.users.findUnique({
      where: {
        id: recruiterId,
      },
    });
    if (foundUser?.role !== "Recrutador") {
      res
        .status(401)
        .json({ message: "Apenas recrutadores podem postar vagas." });
      return;
    }
    const newJob = await prisma.opportunities.create({
      data: {
        title,
        description,
        salary,
        mode,
        remote,
        type,
        recruiterId,
        skills,
        stack,
        benefits,
      },
    });
    res.status(201).json({ message: "Vaga criada com sucesso!" });
    return;
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json(err.errors.map((e) => e.message));
      return;
    }
    console.log(err);
    res.status(500).json({ message: "Erro interno do servidor" });
    return;
  }
};

// * Controller de exlusão de uma vaga
const deleteJob = async (req:Request, res:Response)=> {
    try {
        const {jobId, recruiterId} = req.params as {jobId:string;recruiterId:string}
        const foundUser = await prisma.users.findUnique({where:{id:recruiterId}})
        if(!foundUser){
            res.status(401).json({message: "Apenas recrutadores podem excluir vagas"})
            return
        }
        const foundJob = await prisma.opportunities.findFirst({
            where: {
                AND: [
                    {id:jobId},
                    {recruiterId}
                ]
            }
        })
        if(!foundJob){
            res.status(401).json({message: "Usuário(a) não possui permissão para realizar essa ação"})
            return
        }
        await prisma.opportunities.delete({where:{
            id:jobId
        }})
        res.status(201).json({message: "Vaga excluída com sucesso"})
        return
    } catch (err) {
        console.log(err)
        return res.status(500).json({message: "Erro interno do servidor"})
    }
}

export {applyToJob, createJob}