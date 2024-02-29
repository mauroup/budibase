import tk from "timekeeper"
import { env } from "../.."
import { DBTestConfiguration, generator, structures } from "../../../tests"
import { getDB } from "../../db"
import { DocWritethrough } from "../docWritethrough"
import _ from "lodash"

env._set("MOCK_REDIS", null)

const WRITE_RATE_MS = 500

const initialTime = Date.now()

function resetTime() {
  tk.travel(initialTime)
}
function travelForward(ms: number) {
  const updatedTime = Date.now() + ms
  tk.travel(updatedTime)
}

describe("docWritethrough", () => {
  const config = new DBTestConfiguration()

  const db = getDB(structures.db.id())
  let documentId: string
  let docWritethrough: DocWritethrough

  describe("patch", () => {
    function generatePatchObject(fieldCount: number) {
      const keys = generator.unique(() => generator.word(), fieldCount)
      return keys.reduce((acc, c) => {
        acc[c] = generator.word()
        return acc
      }, {} as Record<string, any>)
    }

    beforeEach(() => {
      resetTime()
      documentId = structures.db.id()
      docWritethrough = new DocWritethrough(db, documentId, WRITE_RATE_MS)
    })

    it("patching will not persist if timeout does not hit", async () => {
      await config.doInTenant(async () => {
        await docWritethrough.patch(generatePatchObject(2))
        await docWritethrough.patch(generatePatchObject(2))
        travelForward(WRITE_RATE_MS - 1)
        await docWritethrough.patch(generatePatchObject(2))

        expect(await db.docExists(documentId)).toBe(false)
      })
    })

    it("patching will persist if timeout hits and next patch is called", async () => {
      await config.doInTenant(async () => {
        const patch1 = generatePatchObject(2)
        const patch2 = generatePatchObject(2)
        await docWritethrough.patch(patch1)
        await docWritethrough.patch(patch2)

        travelForward(WRITE_RATE_MS)

        const patch3 = generatePatchObject(3)
        await docWritethrough.patch(patch3)

        expect(await db.get(documentId)).toEqual({
          _id: documentId,
          ...patch1,
          ...patch2,
          ...patch3,
          _rev: expect.stringMatching(/1-.+/),
          createdAt: new Date(initialTime + WRITE_RATE_MS).toISOString(),
          updatedAt: new Date(initialTime + WRITE_RATE_MS).toISOString(),
        })
      })
    })

    it("date audit fields are set correctly when persisting", async () => {
      await config.doInTenant(async () => {
        const patch1 = generatePatchObject(2)
        const patch2 = generatePatchObject(2)
        await docWritethrough.patch(patch1)
        travelForward(WRITE_RATE_MS)
        const date1 = new Date()
        await docWritethrough.patch(patch2)

        travelForward(WRITE_RATE_MS)
        const date2 = new Date()

        const patch3 = generatePatchObject(3)
        await docWritethrough.patch(patch3)

        expect(date1).not.toEqual(date2)
        expect(await db.get(documentId)).toEqual(
          expect.objectContaining({
            createdAt: date1.toISOString(),
            updatedAt: date2.toISOString(),
          })
        )
      })
    })

    it("patching will not persist even if timeout hits but next patch is not callec", async () => {
      await config.doInTenant(async () => {
        await docWritethrough.patch(generatePatchObject(2))
        await docWritethrough.patch(generatePatchObject(2))

        travelForward(WRITE_RATE_MS)

        expect(await db.docExists(documentId)).toBe(false)
      })
    })

    it("concurrent patches will override keys", async () => {
      await config.doInTenant(async () => {
        const patch1 = generatePatchObject(2)
        await docWritethrough.patch(patch1)
        const time1 = travelForward(WRITE_RATE_MS)
        const patch2 = generatePatchObject(1)
        await docWritethrough.patch(patch2)

        const keyToOverride = _.sample(Object.keys(patch1))!
        expect(await db.get(documentId)).toEqual(
          expect.objectContaining({
            [keyToOverride]: patch1[keyToOverride],
          })
        )

        travelForward(WRITE_RATE_MS)

        const patch3 = {
          ...generatePatchObject(3),
          [keyToOverride]: generator.word(),
        }
        await docWritethrough.patch(patch3)

        expect(await db.get(documentId)).toEqual(
          expect.objectContaining({
            ...patch1,
            ...patch2,
            ...patch3,
          })
        )
      })
    })
  })
})
