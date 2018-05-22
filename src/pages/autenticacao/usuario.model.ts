//import { Img } from "ionic-angular";

export class Model {
    constructor(objeto?) {
        Object.assign(this, objeto);
    }
  }
  
  export class Usuario extends Model {
      codigo: number;
      nome: string;
      email: string;
      confemail: string;
      login: string;
      senha: string;
      confirmsenha: string;
      foto: string;
  }