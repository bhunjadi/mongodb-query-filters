# mongodb-query-filters

Process MongoDB query sent from insecure source based on configuration.

## Usage

`const cleanedQuery = processQuery(query, config)`

`processQuery` throws by default if there is field that is not allowed

## Examples

Try filtering simple equality comparison:
```
const cleanedQuery = processQuery({age: 18}, {
    allowedFields: ['age'],
    errorHandling: {throw: false},
})

cleanedQuery = {age: 18}
```

A little bit more complicated:
```
processQuery({age: {$not: {$eq: 18}}}, {
    allowedFields: [{
        field: 'age',
        operators: {
            $not: true,
            $eq: true,
        },
    }],
})
```
If we would for example change $eq to false in the above example, the function would throw.

Support for $expr, $text, $where (disabled by default):
```
processQuery({$expr: {$lt: ['$spent', '$received']}}, {
    allowedFields: [],
    topLevelOperators: {
        $expr: true,
    },
})
```

## TODO

- Whitelist/Blacklist strategy

