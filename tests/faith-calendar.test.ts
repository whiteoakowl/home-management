import { test } from "node:test";
import assert from "node:assert/strict";
import { ekadashis, hebrewLabel, holidaysFor, liturgicalSeason, omerDay, orthodoxEaster, panchang, rosaryMysteries, westernEaster, type Faith } from "../src/lib/faith-calendar";

const on = (faith: Faith, y: number, key: string) => holidaysFor(faith, y).find((h) => h.key === key)?.date;

test("Easter and the Christian year", () => {
  assert.equal(westernEaster(2024), "2024-03-31");
  assert.equal(westernEaster(2025), "2025-04-20");
  assert.equal(westernEaster(2026), "2026-04-05");
  assert.equal(orthodoxEaster(2024), "2024-05-05");
  assert.equal(orthodoxEaster(2026), "2026-04-12");
  assert.equal(on("christian", 2026, "ash_wednesday"), "2026-02-18");
  assert.equal(on("christian", 2026, "pentecost"), "2026-05-24");
  assert.equal(on("christian", 2026, "advent"), "2026-11-29");
  assert.equal(on("christian", 2024, "advent"), "2024-12-01");
  assert.equal(liturgicalSeason("2026-03-01").key, "lent");
  assert.equal(liturgicalSeason("2026-12-10").key, "advent");
  assert.equal(liturgicalSeason("2026-07-10").key, "ordinary");
});

test("Jewish holidays follow the Hebrew calendar", () => {
  assert.equal(on("jewish", 2024, "passover"), "2024-04-23");
  assert.equal(on("jewish", 2024, "rosh_hashanah"), "2024-10-03");
  assert.equal(on("jewish", 2024, "yom_kippur"), "2024-10-12");
  assert.equal(on("jewish", 2024, "hanukkah"), "2024-12-26");
  assert.equal(on("jewish", 2025, "tisha_bav"), "2025-08-03"); // postponed from Shabbat
  assert.equal(on("jewish", 2026, "purim"), "2026-03-03");
  assert.equal(on("jewish", 2027, "purim"), "2027-03-23"); // leap year: Adar II
  assert.equal(hebrewLabel("2025-09-23"), "1 Tishri 5786");
  assert.equal(omerDay("2026-04-03"), 1);
  assert.equal(omerDay("2026-07-01"), null);
});

test("Hindu festivals match published dates", () => {
  const want: [number, string, string][] = [
    [2024, "maha_shivaratri", "2024-03-08"], [2024, "holi", "2024-03-25"], [2024, "raksha_bandhan", "2024-08-19"], [2024, "janmashtami", "2024-08-26"],
    [2024, "ganesh_chaturthi", "2024-09-07"], [2024, "navaratri", "2024-10-03"], [2024, "dussehra", "2024-10-12"], [2024, "karva_chauth", "2024-10-20"],
    [2024, "diwali", "2024-10-31"], [2024, "makar_sankranti", "2024-01-15"], [2025, "maha_shivaratri", "2025-02-26"], [2025, "holi", "2025-03-14"],
    [2025, "ram_navami", "2025-04-06"], [2025, "raksha_bandhan", "2025-08-09"], [2025, "janmashtami", "2025-08-16"], [2025, "ganesh_chaturthi", "2025-08-27"],
    [2025, "navaratri", "2025-09-22"], [2025, "dussehra", "2025-10-02"], [2025, "karva_chauth", "2025-10-10"], [2025, "diwali", "2025-10-20"],
    [2026, "maha_shivaratri", "2026-02-15"], [2026, "janmashtami", "2026-09-04"], [2026, "diwali", "2026-11-08"],
  ];
  for (const [y, k, d] of want) assert.equal(on("hindu", y, k), d, `${k} ${y}`);
  assert.equal(panchang("2025-10-20").paksha, "Krishna");
  assert.ok(ekadashis("2025-01-01", "2025-12-31").length >= 23);
});

test("Buddhist days", () => {
  assert.equal(on("buddhist", 2024, "vesak"), "2024-05-23");
  assert.equal(on("buddhist", 2025, "vesak"), "2025-05-12");
  assert.equal(on("buddhist", 2025, "magha_puja"), "2025-02-12");
  assert.equal(on("buddhist", 2025, "asalha_puja"), "2025-07-10");
  assert.equal(on("buddhist", 2025, "buddha_birthday"), "2025-05-05");
  assert.equal(on("buddhist", 2025, "lunar_new_year"), "2025-01-29");
});

test("Catholic feasts, holy days and saints", () => {
  assert.equal(on("catholic", 2026, "easter"), "2026-04-05");
  assert.equal(on("catholic", 2026, "divine_mercy"), "2026-04-12");
  assert.equal(on("catholic", 2026, "corpus_christi"), "2026-06-04");
  assert.equal(on("catholic", 2026, "christ_the_king"), "2026-11-22");
  assert.equal(on("catholic", 2024, "immaculate_conception"), "2024-12-09"); // Dec 8 was a Sunday of Advent
  assert.equal(on("catholic", 2024, "annunciation"), "2024-04-08"); // moved out of Holy Week / Easter week
  assert.equal(on("catholic", 2035, "st_joseph"), "2035-03-17"); // Mar 19 in Holy Week → Saturday before Palm Sunday
  assert.equal(on("catholic", 2026, "saint:03-17"), "2026-03-17");
  assert.ok(holidaysFor("catholic", 2026).filter((h) => h.tradition === "Holy Day of Obligation").length >= 6);
  assert.equal(rosaryMysteries("2026-11-20"), "Sorrowful"); // a Friday
});
