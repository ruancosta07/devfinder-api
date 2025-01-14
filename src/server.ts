import express from "express";
import userRoutes from "./routes/user.ts";
import swaggerUi from "swagger-ui-express";
import swaggerDocument from "./swagger.json"
const app = express();

app.use(express.json());
app.use(userRoutes);

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument, {explorer: true}));
app.listen(3000, () => {
  try {
    console.log(`Server is running at 3000 port`);
  } catch (err) {
    console.log(err);
  }
});

export { app };
