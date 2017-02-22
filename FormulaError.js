
// courtesy of http://stackoverflow.com/a/32749533/607407
class ExtendableError extends Error {
  constructor(message) {
    super(message);
    this.name = this.constructor.name;
    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, this.constructor);
    } else { 
      this.stack = (new Error(message)).stack; 
    }
  }
}

class FormulaError extends ExtendableError {
    constructor(message, charOffset, originalString) {
        super(message);
        this.index = charOffset;
        this.str = originalString;
    }
}