/* Matcher for simple symbol
*/
class FormulaSymbol {
    constructor() {
        this.symbols = [];
        // lists of class objects of symbols that precede and follow this symbol
        this.symbolsBefore = [];
        this.symbolsAfter = [];
        // symbols mentioned here cannot be child symbols for this symbol
        this.illegalChild = [];
        this.symbol = function() {throw new Error("No symbol class assigned to syntax symbol "+this.name);};
        // Role of previous and next expression in the tree
        this.prevRole = FormulaSymbol.ROLE_CHILD;
        this.nextRole = FormulaSymbol.ROLE_CHILD;
    }
    // Returns number of characters that fulfil requirements for this symbols
    // zero if no match for this symbol
    // skips any leading whitespace
    matchState(str) {
        if(this.symbols.length == 0)
            return 0;
        // offset for leading whitespace
        var offset = 0;
        while(str[0]==" " || str[0]=="\t") {
             str = str.substr(1);
             offset++;
        }
        for(var i=0, l=this.symbols.length; i<l; ++i) {
            const symbol = this.symbols[i];
            if(str.indexOf(symbol)==0) {
                return symbol.length+offset;
            }
        }
        return 0;
    }
    // converts given string into instance of 
    // actual logic expression type
    // this string must be of correct length (no trailing or eading data)
    parse(str) {
        return new this.symbol(str);
    }
    
    static isLegalChildOf(parent, child) {
        return !parent.illegalChild.find((ctor) => {
            return child instanceof ctor;        
        });    
    }
}
FormulaSymbol.ROLE_PARENT = {};
FormulaSymbol.ROLE_CHILD = {};
FormulaSymbol.implementations = [];


(()=>{
    function registerChild(child) {
        FormulaSymbol.implementations.push(child);
        FormulaSymbol[child.prototype.constructor.name] = child;
    }

    class Negation extends FormulaSymbol {
        constructor() {
            super();
            this.symbols = ["NOT", "!", "¬"];
            this.symbolsAfter = [Negation, Variable, Formula];
            this.name = "negation";
            this.prevRole = FormulaSymbol.ROLE_PARENT;
            this.nextRole = FormulaSymbol.ROLE_CHILD;
            this.symbol = FormulaExpression.Negation;
        }
    }
    registerChild(Negation);
    
    class Variable extends FormulaSymbol {
        constructor() {
            super();
            var symbols = this.symbols = [];
            var start = "a".charCodeAt(0);
            var end = "z".charCodeAt(0);
            for(;start<=end; ++start) {
                symbols.push(String.fromCharCode(start));
            }
            this.name = "logic variable";
            
            this.symbolsAfter = [BinaryOperator];
            this.symbol = FormulaExpression.Variable;
            this.prevRole = FormulaSymbol.ROLE_PARENT;
            this.nextRole = FormulaSymbol.ROLE_PARENT;
        }
        matchState(str) {
            var state = FormulaSymbol.prototype.matchState.call(this, str);
            if(state>0 && str.length>state+1) {
                // check if there's another letter after this variable
                // in that case this would not match at all
                if(str[state].match(/[a-z]/i)) {
                    return 0;
                }
            }
            return state;
        }
    }
    registerChild(Variable);
    class Formula extends FormulaSymbol {
        constructor() {
            super();
            this.symbolsAfter = [BinaryOperator];
            this.name = "formula expression";
            this.symbol = FormulaExpression.Formula;
            this.prevRole = FormulaSymbol.ROLE_PARENT;
            this.nextRole = FormulaSymbol.ROLE_PARENT;
        }
        matchState(str) {
            if(str[0]!="(")
                return 0;
            var openBrackets = 1;
            var i = 1;
            const l = str.length;
            for(; i<l && openBrackets>0; ++i) {
                if(str[i]=="(")
                    openBrackets++;
                if(str[i]==")")
                    openBrackets--;
            }
            if(openBrackets>0) {
                throw new Error("Missing closing bracket!");
                return 0;
            }
            return i;
        }
        parse(str) {
            var allSymbols = [Negation, Variable, Formula, Conjunction, Disjunction, Equivalence, Implication];
            for(var i=0,l=allSymbols.length; i<l; ++i) {
                allSymbols[i] = new allSymbols[i]();
            }
            // number of characters since the start of the string
            // used for error reporting
            var chars = 0;
            const originalString = str;
            // remove any trailing whitespace
            while(str.endsWith(" ")) {
                str = str.substr(0, str.length-1);
            }
            // remove any enclosing brackets
            while(Formula.hasEnclosingBrackets(str)) {
                str = str.substr(1, str.length-2);
                chars++;
                // clear leading whitespace
                while(str[0]==" " || str[0]=="\t") {
                    str = str.substr(1);
                    chars++;
                }
                while(str.endsWith(" ")) {
                    str = str.substr(0, str.length-1);
                }
            }
            // This is to be assigned as an either child or parent to the new objects
            var previousObject = null;
            var currentObject = null;
            
            var previousSymbol = null;
            var currentSymbol = null;
            var topObject = null;
            var parentStack = [];
            var variableNames = [];
            
            while(str.length>0) {
                var matchingSymbols = [];
                // clear leading whitespace
                while(str[0]==" " || str[0]=="\t") {
                    str = str.substr(1);
                    chars++;
                }
                if(str.length==0)
                    break;
                
                for(var i=0,l=allSymbols.length; i<l; ++i) {
                    var matches = allSymbols[i].matchState(str);
                    if(matches>0) {
                        matchingSymbols.push({count: matches, symbol: allSymbols[i]}); 
                        console.log(allSymbols[i].constructor.name + " matches:"+str.substr(0,matches)); 
                    }
                }
                if(matchingSymbols.length>1) {
                    throw new FormulaError("Ambiguous syntax!", chars, originalString);
                }
                else if(matchingSymbols.length==0) {
                    throw new FormulaError("Unknown expression or symbol!", chars, originalString);
                }
                else {
                    previousObject = currentObject;
                    previousSymbol = currentSymbol;
                    currentSymbol = matchingSymbols[0].symbol;
                    try {
                        currentObject = matchingSymbols[0].symbol.parse(str.substr(0,matchingSymbols[0].count));
                        currentObject.symbol = matchingSymbols[0].symbol;
                    }
                    catch(e) {
                        throw new FormulaError(e.message.length!=0?e.message:"Unknown error!", chars, originalString);
                    }
                    // this is little stinky
                    // remembers what variable names were used
                    if(currentObject instanceof FormulaExpression.Variable) {
                        if(variableNames.indexOf(currentObject.name)==-1)
                            variableNames.push(currentObject.name);
                    }
                    // this sucks variable names from child formulas
                    else if(currentObject instanceof FormulaExpression.Formula && currentObject.variables) {
                        currentObject.variables.forEach((name)=>{
                            if(variableNames.indexOf(name)==-1)
                                variableNames.push(name);
                        });
                    }
                    // verify if this symbol is expected at this place
                    if(previousSymbol != null) {
                        var expectedSymbol = previousSymbol.symbolsAfter.find((ctor)=> {
                            return currentSymbol instanceof ctor;
                        });
                        if(!expectedSymbol) {
                            this.expectedSymbolError(currentSymbol, previousSymbol.symbolsAfter, chars, originalString); 
                        }
                    }

                    
                    if(previousObject!=null) {
                        if(currentSymbol.prevRole == FormulaSymbol.ROLE_CHILD) {
                            var topParent = previousObject.topParent();
                            currentObject.addChild(topParent);
                            if(!FormulaSymbol.isLegalChildOf(topParent.symbol, currentObject.symbol)) {
                                throw new FormulaError(currentObject.symbol.name+" cannot be direct sibling of "+topParent.symbol.name, chars, originalString);
                            }
                            console.log("Adding "+topParent.constructor.name+" to "+currentObject.constructor.name);
                        }
                        else if(currentSymbol.prevRole == FormulaSymbol.ROLE_PARENT) {
                            if(parentStack.length == 0)
                                throw new FormulaError("Unexpected child node!", chars, originalString);
                            parentStack[0].addChild(currentObject);
                            parentStack.splice(0, 1);
                            //if(currentSymbol.nextRole == FormulaSymbol.ROLE_CHILD) {
                            //    t
                            //}    
                            
                            console.log("Adding "+currentObject.constructor.name+" to "+previousObject.constructor.name);
                        }
                    }
                    else {
                        topObject = currentObject;
                    }
                    // if next object is supposed to be child node, 
                    // queue the parent node to wait for it
                    if(currentSymbol.nextRole == FormulaSymbol.ROLE_CHILD) {
                        parentStack.unshift(currentObject);
                        console.log("New parent on stack: "+currentObject.constructor.name);
                    }
                    str = str.substr(matchingSymbols[0].count);
                    chars += matchingSymbols[0].count;
                    console.log("TOP: ", topObject);
                }
            }
            if(parentStack.length!=0) {
                throw new FormulaError("Missing right-hand operand for "+parentStack[0].constructor.name, chars, originalString);
            }
            if(currentObject == null)
                throw new Error("Formula is empty!");
            
            var result = new FormulaExpression.Formula(currentObject.topParent());
            variableNames.sort();
            result.variables = variableNames;
            return result;
        }
        expectedSymbolError(found, expected, chars, originalString) {
            throw new FormulaError("Unexpected "+found.name+" expecting "+expected.map((ctor)=>{
                var entry = new ctor();
                if(entry.symbols && entry.symbols.length>0) 
                    return entry.name + " ("+entry.symbols.join(", ")+")";
                else
                    return entry.name;
            }).join(", "), chars, originalString);
        }
        static hasEnclosingBrackets(str) {
            var brackets = 0;
            for(var i=0,l=str.length; i<l;++i) {
                if(i>0 && brackets==0)
                    return false;
                if(str[i]=="(")
                    brackets++;
                if(str[i]==")")
                    brackets--;
            }
            return brackets == 0;
        }
    }
    registerChild(Formula);
    class BinaryOperator extends FormulaSymbol {
        constructor() {
            super();           
            this.prevRole = FormulaSymbol.ROLE_CHILD;
            this.nextRole = FormulaSymbol.ROLE_CHILD;
            this.symbolsAfter = [Negation, Variable, Formula];
            this.illegalChild = [BinaryOperator];
            this.name = "binary operator";
        }
    }
    
    class Disjunction extends BinaryOperator {
        constructor() {
            super();
            this.symbol = FormulaExpression.Disjunction;
            this.symbols = ["OR", "||", "∨"];
            this.illegalChild = [Conjunction, Equivalence, Implication];
            this.name = "dinsjunction";
        }
    }
    registerChild(Disjunction);
    class Conjunction extends BinaryOperator {
        constructor() {
            super();
            this.symbol = FormulaExpression.Conjunction;
            this.symbols = ["AND", "&&", "∧"];
            this.illegalChild = [Disjunction, Equivalence, Implication];
            this.name = "conjunction";
        }
    }
    registerChild(Conjunction);
    class Equivalence extends BinaryOperator {
        constructor() {
            super();
            this.symbol = FormulaExpression.Equivalence;
            this.symbols = ["EQ", "==", "<=>", "⇔"];
            this.name = "equivalence";
        }
    }
    registerChild(Equivalence);
    class Implication extends BinaryOperator {
        constructor() {        
            super();
            this.symbol = FormulaExpression.Implication;
            this.symbols = ["IMPL", "=>", "⇒"];
            this.name = "implication";
        }
    }
    registerChild(Disjunction);
})();