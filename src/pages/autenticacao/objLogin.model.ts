export class Model {
    constructor(objeto?) {
        Object.assign(this, objeto);
    }
  }
  
  export class objLogin extends Model {
    enable_profile_selector: boolean;
    return_scopes: boolean;
    scope: string;
    auth_type: string;
  }