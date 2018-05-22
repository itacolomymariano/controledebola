//import { Img } from "ionic-angular";

export class Model {
    constructor(objeto?) {
        Object.assign(this, objeto);
    }
  }
  
  export class Pessoa extends Model {
    id: string;  
    nome: string;
    email: string;
    senha: string;
    dtaniversario: Date;
    foto: string;
    idade: number;
    altura: number;
    peso: number;
    chuteira?: number;
    fone?: string;
    //idfunc: string;
    nmfunc: string;

  }