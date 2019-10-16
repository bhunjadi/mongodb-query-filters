import {stub} from 'sinon';
import {expect} from 'chai';
import {processQuery, setDefaultConfig} from '../src/index';

describe('processFilters - cleaning', () => {
    before(() => {
        setDefaultConfig({
            errorHandling: {
                throw: false,
            },
        });
    });

    describe('basic', () => {
        it('works with simple', () => {
            expect(processQuery({
                age: 18,
            }, {
                allowedFields: ['age'],
                errorHandling: {throw: false},
            })).to.eql({
                age: 18,
            });
        });
    
        it('works with explicit operator', () => {
            expect(processQuery({
                age: {$gt: 18},
            }, {
                allowedFields: ['age'],
            })).to.eql({
                age: {$gt: 18},
            });
        });
    
        it('works with multiple operators', () => {
            expect(processQuery({
                age: {$gt: 18, $lt: 50},
            }, {
                allowedFields: ['age'],
            })).to.eql({
                age: {$gt: 18, $lt: 50},
            });
        });
    
        it('removes forbidden field', () => {
            expect(processQuery({
                age: 18,
            }, {
                allowedFields: [],
            })).to.eql({});
        });
    
        it('works with logical $and', () => {
            expect(processQuery({
                $and: [{age: 18}],
            }, {
                allowedFields: ['age'],
            })).to.eql({$and: [{age: 18}]});
        });
    });

    describe('explicit operator permissions', () => {
        it('works with $eq allowed', () => {
            expect(processQuery({age: 18}, {
                allowedFields: [{
                    field: 'age',
                    operators: {
                        $eq: true,
                    },
                }],
            })).to.eql({age: 18});
        });

        it('works with $eq forbidden', () => {
            expect(processQuery({age: 18}, {
                allowedFields: [{
                    field: 'age',
                    operators: {
                        $eq: false,
                    },
                }],
            })).to.eql({});
        });

        it('works with $not, $eq allowed', () => {
            expect(processQuery({age: {$not: {$eq: 18}}}, {
                allowedFields: [{
                    field: 'age',
                    operators: {
                        $not: true,
                        $eq: true,
                    },
                }],
            })).to.eql({age: {$not: {$eq: 18}}});
        });

        it('works with $not, but $eq forbidden', () => {
            expect(processQuery({age: {$not: {$eq: 18}}}, {
                allowedFields: [{
                    field: 'age',
                    operators: {
                        $not: true,
                        $eq: false,
                    },
                }],
            })).to.eql({});
        });

        it('filters with $not forbidden, but $eq allowed', () => {
            expect(processQuery({age: {$not: {$eq: 18}}}, {
                allowedFields: [{
                    field: 'age',
                    operators: {
                        $not: false,
                        $eq: true,
                    },
                }],
            })).to.eql({});
        });
    });

    describe('$elemMatch', () => {
        it('filters $elemMatch', () => {
            expect(processQuery({results: {$elemMatch: {$gt: 30, $lt: 50}}}, {
                allowedFields: [{
                    field: 'results',
                    operators: {
                        $elemMatch: false,
                    },
                }],
            })).to.eql({});
        });

        it('filters $elemMatch - no additional operators', () => {
            expect(processQuery({results: {$elemMatch: {$gt: 30, $lt: 50}}}, {
                allowedFields: [{
                    field: 'results',
                    operators: {
                        $elemMatch: true,
                    },
                }],
            })).to.eql({});
        });

        it('allows $elemMatch', () => {
            expect(processQuery({results: {$elemMatch: {$gt: 30, $lt: 50}}}, {
                allowedFields: [{
                    field: 'results',
                    operators: {
                        $elemMatch: true,
                        $gt: true,
                        $lt: true,
                    },
                }],
            })).to.eql({results: {$elemMatch: {$gt: 30, $lt: 50}}});
        });

        const NESTED_ELEM_MATCH = {
            results: {
                $elemMatch: {
                    rate: 1,
                },
            },
        };

        it('filters nested $elemMatch', () => {
            expect(processQuery(NESTED_ELEM_MATCH, {
                allowedFields: [{
                    field: 'results',
                    operators: {
                        $elemMatch: true,
                    },
                }],
            })).to.eql({});
        });

        it('filters nested $elemMatch', () => {
            expect(processQuery(NESTED_ELEM_MATCH, {
                allowedFields: [{
                    field: 'results',
                    operators: {
                        $elemMatch: true,
                    },
                }, {
                    field: 'results.rate',
                    operators: {
                        $eq: true,
                    },
                }],
            })).to.eql(NESTED_ELEM_MATCH);
        });
    });

    describe('nested fields', () => {
        const NESTED_FIELDS = {
            'emails.sent': {$gt: new Date()},
        };

        it('filters nested fields', () => {
            expect(processQuery(NESTED_FIELDS, {
                allowedFields: [{
                    field: 'emails.sent',
                    operators: {
                        $eq: true,
                    },
                }],
            })).to.eql({});
        });

        it('works with nested fields', () => {
            expect(processQuery(NESTED_FIELDS, {
                allowedFields: [{
                    field: 'emails.sent',
                    operators: {
                        $gt: true,
                    },
                }],
            })).to.eql(NESTED_FIELDS);
        });
    });

    describe('$expr - top level operator', () => {
        const EXPR_QUERY = {
            $expr: {
                $lt: ['$spent', '$received'],
            },
        };

        it('filters $expr', () => {
            expect(processQuery(EXPR_QUERY, {
                allowedFields: [],
                topLevelOperators: {
                    $expr: false,
                },
            })).to.eql({});
        });

        it('allows $expr', () => {
            expect(processQuery(EXPR_QUERY, {
                allowedFields: [],
                topLevelOperators: {
                    $expr: true,
                },
            })).to.eql(EXPR_QUERY);
        });
    });

    describe('multiple fields', () => {
        const MULTIPLE_FIELDS_QUERY_1 = {
            age: 18,
            name: {$gt: 'K'},
        };

        it('works with multiple fields', () => {
            expect(processQuery(MULTIPLE_FIELDS_QUERY_1, {
                allowedFields: [{
                    field: 'age',
                    operators: {
                        $eq: true,
                    },
                }, {
                    field: 'name',
                }],
            })).to.eql(MULTIPLE_FIELDS_QUERY_1);
        });

        it('filters partially multiple fields', () => {
            expect(processQuery(MULTIPLE_FIELDS_QUERY_1, {
                allowedFields: [{
                    field: 'age',
                    operators: {
                        $eq: true,
                    },
                }],
            })).to.eql({age: 18});
        });

        it('filters all', () => {
            expect(processQuery(MULTIPLE_FIELDS_QUERY_1, {
                allowedFields: [{
                    field: 'name',
                    operators: {
                        $eq: true,
                    },
                }],
            })).to.eql({});
        });

        const MULTIPLE_FIELDS_QUERY_2 = {
            ...MULTIPLE_FIELDS_QUERY_1,
            $text: {$gt: ['$a', '$b']},
        };

        it('allows $text', () => {
            expect(processQuery(MULTIPLE_FIELDS_QUERY_2, {
                allowedFields: [{
                    field: 'age',
                    operators: {
                        $eq: true,
                    },
                }, {
                    field: 'name',
                }],
                topLevelOperators: {
                    $text: true,
                },
            })).to.eql(MULTIPLE_FIELDS_QUERY_2);
        });

        it('filters $text', () => {
            expect(processQuery(MULTIPLE_FIELDS_QUERY_2, {
                allowedFields: [{
                    field: 'age',
                    operators: {
                        $eq: true,
                    },
                }, {
                    field: 'name',
                }],
                topLevelOperators: {
                    $text: false,
                },
            })).to.eql(MULTIPLE_FIELDS_QUERY_1);
        });
    });
});

describe('processFilters - throw on Error', () => {
    before(() => {
        setDefaultConfig({
            errorHandling: {
                throw: true,
            },
        });
    });

    it('throws on forbidden field', () => {
        expect(() => {
            processQuery({age: 18}, {allowedFields: []});
        }).to.throw(/Field age not allowed by schema/i);
    });

    it('throws on forbidden operator', () => {
        expect(() => {
            processQuery({age: 18}, {allowedFields: [{
                field: 'age',
                operators: {
                    $eq: false,
                },
            }]});
        }).to.throw(/Operator\(s\) \$eq for field age/i);
    });

    it('throws on $elemMatch', () => {
        expect(() => {
            processQuery({results: {$elemMatch: {age: 18}}}, {allowedFields: [{
                field: 'results',
                operators: {
                    $elemMatch: true,
                },
            }]});
        }).to.throw(/Field results\.age not allowed by schema/i);
    });

    it('throws on $where', () => {
        expect(() => {
            processQuery({$expr: {}}, {
                allowedFields: [{
                    field: 'results',
                    operators: {
                        $elemMatch: true,
                    },
                }],
            });
        }).to.throw(/Operator \$expr not allowed/i);
    });

    it('throws on top level array operators', () => {
        expect(() => {
            processQuery({
                $or: [{age: {$gt: 18}}],
            }, {
                allowedFields: [],
            });
        }).to.throw(/Field age not allowed/i);
    });
});

describe('processFilters - throw on Error', () => {
    let onErrorCallback = stub();

    beforeEach(() => {
        setDefaultConfig({
            errorHandling: {
                onError: onErrorCallback,
            },
        });
    });

    it('works on forbidden field', () => {
        processQuery({age: 18}, {allowedFields: []});

        expect(onErrorCallback.callCount).to.equal(1);
        
        const [callArgs] = onErrorCallback.args;

        expect(callArgs).to.have.length(1);
        const [arg] = callArgs;
        expect(arg.config).to.be.an('object');
        expect(arg.message).to.equal('Field age not allowed by schema.');
        expect(arg.context).to.be.an('object');
        expect(arg.context.name).to.equal('age');
        expect(arg.context.value).to.equal(18);
    });
});
