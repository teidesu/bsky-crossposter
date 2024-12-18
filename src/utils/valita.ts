import * as v from '@badrap/valita'

export const DateType = v.string().chain((s) => {
    const date = new Date(s)

    if (Number.isNaN(+date)) {
        return v.err('invalid date')
    }

    return v.ok(date)
})
