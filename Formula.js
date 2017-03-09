class FormulaExpression {
    constructor() {}
    evaluate(variables) {
        return false;
    }
    addChild() {
        throw new Error("This formula cannot have children!");
    }
    topParent() {
        var node = this;
        while(node.parent!=null) {
            node=node.parent;
        }
        return node;
    }
    depth() {
        return 0;
    }
}
class Formula extends FormulaExpression {
    constructor(child) {
        super();
        this.child = child instanceof FormulaExpression?child:null;
    }
    evaluate(variables) {
        var result = this.child.evaluate(variables);
        console.log("Formula evaluates to "+result);
        return result;
    }
    addChild(child) {
        if(this.child == null) {
            this.child = child;
            child.parent = this;
        }
        else {
            throw new Error("Too many children added to "+this.constructor.name);
        }
    }
    depth() {
        return this.child.depth();
    }
}
FormulaExpression.Formula = Formula;
class Variable extends FormulaExpression {
    constructor(varName) {
        super();
        this.name = varName;
    }
    evaluate(variables) {
        console.log("Variable "+this.name+" is "+(variables[this.name]===true)+".", variables);
        return variables[this.name]===true;
    }
}
FormulaExpression.Variable = Variable;
class BinaryOperator extends FormulaExpression {
    constructor() {
        super();
        this.children = [];
        this.multiChild = false;
    }
    evaluateTwoValues(a,b) {return false;}
    evaluate(variables) {
        if(this.children.length<2)
            throw new Error("Tried to evaluate incomplete expression!");
        return this.evaluateTwoValues(this.children[0].evaluate(variables), this.children[1].evaluate(variables));
    }
    addChild(child) {
        if(this.multiChild || this.children.length<2) {
            this.children.push(child);
            child.parent = this;
        }
        else {
            throw new Error("Too many children added to "+this.constructor.name);
        }
    }
    depth() {
        return Math.max.apply(null, this.children.map((child)=>{return child.depth();})) + 1;
    }
} 
class Negation extends Formula {
    evaluate(variables) {
        return !(this.child.evaluate(variables));
    }
    // unlike normal formula, negation counts as depth level
    depth() {
        return this.child.depth()+1;
    }
}
FormulaExpression.Negation = Negation;
class MultiOperator extends BinaryOperator {
    constructor() {
        super();
        this.multiChild = true;
    } 
    evaluate(variables) {
        if(this.children.length<2)
            throw new Error("Tried to evaluate incomplete expression!");
        var firstValue = this.children[0].evaluate(variables);
        for(var i=1, l=this.children.length; i<l; ++i) {
            firstValue = this.evaluateTwoValues(firstValue, this.children[i].evaluate(variables));
        }
        console.log(this, " evaluates to ",firstValue);
        return firstValue;
    }    
}
class Implication extends BinaryOperator {
    evaluateTwoValues(a,b) {
        return b || !a;
    }
}
FormulaExpression.Implication = Implication;
class Equivalence extends MultiOperator {
    evaluateTwoValues(a,b) {
        return a==b;
    }
}
FormulaExpression.Equivalence = Equivalence;
class Conjunction extends MultiOperator {
    evaluateTwoValues(a,b) {
        return a && b;
    }
}
FormulaExpression.Conjunction = Conjunction;
class Disjunction extends MultiOperator {
    evaluateTwoValues(a,b) {
        return a || b;
    }
}
FormulaExpression.Disjunction = Disjunction;

class ExclusiveOr extends MultiOperator{
    evaluateTwoValues(a,b){
        return a != b;
    }
}
FormulaExpression.ExclusiveOr = ExclusiveOr;
