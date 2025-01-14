import request from "supertest";
import { app as server } from "../server";
import { faker } from "@faker-js/faker";
describe("Rota de ações do usuário", () => {
  it("Deve criar uma conta normalmente na rota /criar-conta quando todos os dados do corpo da requisição forem válidos", async () => {
    const newUser = {
      name: faker.person.fullName(),
      email: faker.internet.email({ firstName: "Ruan" }),
      password: "Ruan1234",
      role: "Candidato",
    };
    const response = await request(server).post("/criar-conta").send(newUser);
    expect(response.status).toBe(201);
  });
  it("Deve retornar um erro quando algum dado estiver faltando no corpo da requisição da rota /criar-conta", async () => {
    const newUser = {
      name: faker.person.fullName(),
      email: faker.internet.email({ firstName: "Ruan" }),
      password: "Ruan1234",
    };
    const response = await request(server).post("/criar-conta").send(newUser);
    expect(response.statusCode).toBe(400);
  });
  it("Deve retornar um erro quando o email fornecido não pertencer a nenhum usuário da rota /login", async () => {
    const body = {
      email: faker.internet.email(),
      password: "Teste1234",
    };
    const response = await request(server).post("/login").send(body);
    expect(response.statusCode).toBe(400);
  });
  it("Deve fazer login normalmente quando o usuário inserir email e senha corretos e não possuir código de verificação de duas etapas na rota /login", async () => {
    const body = {
      email: "ruancosta.ti0805@gmail.com",
      password: "Ruan1234",
    };
  
    const response = await request(server).post("/login").send(body);
  
    expect(response.statusCode).toBe(200); 
    expect(response.body).toEqual(
      expect.objectContaining({
        message: "Login realizado com sucesso", 
        token: expect.any(String), 
        twoStepsAuth: expect.any(Boolean), 
        user: expect.objectContaining({
          id: expect.any(String), 
          email: "ruancosta.ti0805@gmail.com", 
          name: "Ruan Costa", 
          avatar: null, 
        }),
      })
    );
  });
  
});
