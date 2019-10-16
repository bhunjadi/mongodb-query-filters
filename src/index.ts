// const COMPARISON_OPERATORS = ['$eq', '$gt', '$gte', '$in', '$lt', '$lte', '$ne', '$nin'];

// const LOGICAL_OPERATORS = ['$and', '$not', '$nor', '$or'];

const OPERATORS_WITH_ARRAY = ['$and', '$or', '$nor'];

const SPECIAL_TOP_LEVEL_OPERATORS = ['$expr', '$text', '$where', '$comment'];

interface ErrorHandlingConfig {
    throw?: boolean;
    onError?(error: ErrorCallback): void;
}

type FieldOperators = { [key: string]: boolean };

type TopLevelOperators = { [key: string]: boolean };

interface FieldObject {
    field: string;
    allowed?: boolean;
    operators?: FieldOperators;
}

interface FieldObjectExtension {
    allowed: boolean;
}

type Field = string | FieldObject;

type Query = { [key: string]: any };

interface ErrorContext {
    type: string;
    name: string;
    value: any;
    definition?: FieldObject;
    operators?: string[];
}

type ErrorCallback = {
    config: FiltersConfig;
    message: string;
    context: ErrorContext;
};

interface FiltersConfig {
    allowedFields?: Field[];
    topLevelOperators?: TopLevelOperators;
    errorHandling?: ErrorHandlingConfig;
}

const DEFAULT_CONFIG: FiltersConfig = {
    allowedFields: [],
    errorHandling: { throw: true },
    topLevelOperators: {},
};

let defaultConfig = DEFAULT_CONFIG;

function isObject(value: any): boolean {
    return typeof value === 'object' && value !== null;
}

function isArray(value: any): boolean {
    return isObject(value) && value.constructor === Array;
}

function handleError(config: FiltersConfig, message: string, context: ErrorContext): void {
    if (config.errorHandling.throw) {
        throw new Error(message);
    } else if (config.errorHandling.onError) {
        config.errorHandling.onError({
            config,
            message,
            context,
        });
    }
}

function normalizeField(field: Field, extension: FieldObjectExtension): FieldObject {
    if (typeof field === 'string') {
        return {
            field,
            ...extension,
        };
    }

    return {
        ...field,
        ...extension,
    };
}

function normalizeFields(fields: Field[], extension: FieldObjectExtension): FieldObject[] {
    return fields.map(field => normalizeField(field, extension));
}

function isOperatorExpression(object: any): boolean {
    if (isObject(object)) {
        const keys = Object.keys(object);
        return keys.every(key => key.startsWith('$'));
    }
    return false;
}

function getFieldDef(config: FiltersConfig, name: string): FieldObject {
    return (config.allowedFields as FieldObject[]).find(f => f.field === name);
}

function isFieldAllowed(name: string, value: any, config: FiltersConfig): boolean {
    const fieldDefinition = getFieldDef(config, name);
    if (fieldDefinition && fieldDefinition.allowed) {
        if (!fieldDefinition.operators) {
            return true;
        }

        const normalizedValue = isOperatorExpression(value) ? value : { $eq: value };
        const operators = Object.keys(normalizedValue);

        // handle $not
        if (operators.length === 1 && operators[0] === '$not') {
            return fieldDefinition.operators.$not && isFieldAllowed(name, value.$not, config);
        }
        // handle $elemMatch
        if (operators.length === 1 && operators[0] === '$elemMatch') {
            if (fieldDefinition.operators.$elemMatch) {
                const elemMatchValue = value.$elemMatch;
                if (isOperatorExpression(elemMatchValue)) {
                    return isFieldAllowed(name, elemMatchValue, config);
                }

                // it is elemMatch for object
                return Object.keys(elemMatchValue).every(key => {
                    const elemMatchObjectValue = elemMatchValue[key];
                    const fieldName = `${fieldDefinition.field}.${key}`;
                    // const nestedDef = getFieldDef(config, fieldName);
                    return isFieldAllowed(fieldName, elemMatchObjectValue, config);
                });
            }
        }

        const forbiddenOperators = operators.filter((operator: string) => !fieldDefinition.operators[operator]);
        if (forbiddenOperators.length === 0) {
            return true;
        }

        handleError(config, `Operator(s) ${forbiddenOperators.join(', ')} for field ${name} are not allowed.`, {
            definition: fieldDefinition,
            type: 'operator',
            operators: forbiddenOperators,
            name,
            value,
        });
    }

    handleError(config, `Field ${name} not allowed by schema.`, {
        name,
        value,
        type: 'field',
    });

    return false;
}

function getQuery(query: Query, { config, level }: { config: FiltersConfig; level: number }): Query {
    const keys = Object.keys(query);
    const cleanedFilters = {} as Query;

    keys.forEach(key => {
        const value = query[key] as any;
        if (OPERATORS_WITH_ARRAY.indexOf(key) > -1) {
            if (!isArray(value)) {
                throw new Error(`Expected array value for operator ${key}, got ${typeof value}`);
            }

            cleanedFilters[key] = value.map((v: Query) => getQuery(v, { config, level: level + 1 }));
        } else if (SPECIAL_TOP_LEVEL_OPERATORS.indexOf(key) > -1) {
            if (level === 0 && config.topLevelOperators[key]) {
                cleanedFilters[key] = value;
                return;
            }
            handleError(config, `Operator ${key} not allowed.`, {
                type: 'operator',
                name: key,
                value,
            });
        } else if (isFieldAllowed(key, value, config)) {
            cleanedFilters[key] = value;
        }
    });

    return cleanedFilters;
}

export function processQuery(query: Query, config: FiltersConfig): Query {
    if (!isObject(query)) {
        throw new Error('Query must be an object');
    }

    config = { ...defaultConfig, ...config };
    config.allowedFields = normalizeFields(config.allowedFields, { allowed: true });

    return getQuery(query, { config, level: 0 });
}

export function setDefaultConfig(defaults: FiltersConfig): void {
    defaultConfig = { ...DEFAULT_CONFIG, ...defaults };
}
