/*
 * A32NX
 * Copyright (C) 2020-2021 FlyByWire Simulations and its contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

class CDUWindPage {

    static Return() {}

    static ShowPage(mcdu) {
        CDUWindPage.ShowCLBPage(mcdu);
    }

    static ShowCLBPage(mcdu, offset = 0) {
        mcdu.clearDisplay();
        mcdu.page.Current = mcdu.page.ClimbWind;

        const template = ([
            ["CLIMB WIND"],
            ["TRU WIND/ALT", "HISTORY[color]inop"],
            ["", "WIND>[color]inop"],
            ["", ""],
            ["", ""],
            ["", "WIND{sp}[color]inop"],
            ["", "REQUEST*[color]inop"],
            ["", ""],
            ["", ""],
            ["", "NEXT{sp}"],
            ["", "PHASE>"],
            ["", ""],
            ["<RETURN", ""],
        ]);

        mcdu.setTemplate(CDUWindPage.ShowWinds(template, mcdu, CDUWindPage.ShowCLBPage, mcdu.winds.climb, offset, 5));

        mcdu.onRightInput[4] = () => {
            CDUWindPage.ShowCRZPage(mcdu);
        };

        mcdu.onLeftInput[5] = () => {
            CDUWindPage.Return();
        };
    }

    static ShowCRZPage(mcdu, offset = 0) {

        //TODO: allow wind to be set for each waypoint

        mcdu.clearDisplay();
        mcdu.page.Current = mcdu.page.CruiseWind;

        const template = ([
            //["CRZ WIND {small}AT{end} {green}WAYPOINT{end}"],
            ["CRZ WIND"],
            ["TRU WIND/ALT", ""],
            ["", ""],
            ["", ""],
            ["", ""],
            ["", "WIND{sp}[color]inop"],
            ["", "REQUEST*[color]inop"],
            ["", "PREV{sp}"],
            ["", "PHASE>"],
            ["{small}SAT / ALT{end}[color]inop", "NEXT{sp}"],
            ["[ ]°/[{sp}{sp}{sp}][color]inop", "PHASE>"],
            ["", ""],
            ["<RETURN", ""],
        ]);

        mcdu.setTemplate(CDUWindPage.ShowWinds(template, mcdu, CDUWindPage.ShowCRZPage, mcdu.winds.cruise, offset, 4));

        mcdu.onRightInput[3] = () => {
            CDUWindPage.ShowCLBPage(mcdu);
        };
        mcdu.onRightInput[4] = () => {
            CDUWindPage.ShowDESPage(mcdu);
        };

        mcdu.onLeftInput[5] = () => {
            CDUWindPage.Return();
        };
    }

    static ShowDESPage(mcdu, offset = 0) {
        mcdu.clearDisplay();
        mcdu.page.Current = mcdu.page.DescentWind;

        let alternateCell = "[ ]°/[ ][color]cyan";

        if (mcdu.winds.alternate != null) {
            alternateCell = `${CDUWindPage.FormatNumber(mcdu.winds.alternate.direction)}°/${CDUWindPage.FormatNumber(mcdu.winds.alternate.speed)}[color]cyan`;
        }

        const template = [
            ["DESCENT WIND"],
            ["TRU WIND/ALT", "ALTN WIND"],
            ["", alternateCell],
            ["", "{green}{small}FL100{end}{end}"],
            ["", ""],
            ["", "WIND{sp}[color]inop"],
            ["", "REQUEST*[color]inop"],
            ["", "PREV{sp}"],
            ["", "PHASE>"],
            ["", ""],
            ["", ""],
            ["", ""],
            ["<RETURN", ""],
        ];

        mcdu.setTemplate(CDUWindPage.ShowWinds(template, mcdu, CDUWindPage.ShowDESPage, mcdu.winds.des, offset, 5));

        mcdu.onRightInput[0] = (value) => {
            if (value == FMCMainDisplay.clrValue) {
                mcdu.winds.alternate = null;
                CDUWindPage.ShowDESPage(mcdu, offset);
                return;
            }
            const wind = CDUWindPage.ParseWind(value);
            if (wind == null) {
                mcdu.addNewMessage(NXSystemMessages.formatError);
            } else {
                mcdu.winds.alternate = wind;
                CDUWindPage.ShowDESPage(mcdu, offset);
            }
        };

        mcdu.onRightInput[3] = () => {
            CDUWindPage.ShowCRZPage(mcdu);
        };

        mcdu.onLeftInput[5] = () => {
            CDUWindPage.Return();
        };
    }

    static FormatNumber(n, leadingZeroes) {
        let output = `${n.toFixed(0)}`;
        for (let i = 0; i < leadingZeroes; i++) {
            if (n < (10 ** (leadingZeroes - i))) {
                output = `0${output}`;
            }
        }
        return output;
    }

    static ShowWinds(rows, mcdu, _showPage, _winds, _offset, _max = 3) {
        let entries = 0;
        for (let i = 0; i < (_winds.length - _offset); i++) {
            if (i < _max) {
                const wind = _winds[i + _offset];
                rows[(i * 2) + 2][0] = `${CDUWindPage.FormatNumber(wind.direction, 2)}°/${CDUWindPage.FormatNumber(wind.speed, 2)}/FL${CDUWindPage.FormatNumber(wind.altitude, 2)}[color]cyan`;
                entries = i + 1;
                mcdu.onLeftInput[i] = (value) => {
                    if (value == FMCMainDisplay.clrValue) {
                        _winds.splice(i + _offset, 1);
                        _showPage(mcdu, _offset);
                    }
                };
            }
        }
        if (entries < _max) {
            rows[(entries * 2) + 2][0] = "{cyan}[ ]°/[ ]/[{sp}{sp}{sp}]{end}";
            mcdu.onLeftInput[entries] = (value) => {
                CDUWindPage.TryAddWind(mcdu, _winds, value, () => {
                    _showPage(mcdu, _offset);
                });
            };
        }

        mcdu.onDown = () => {
            if (_winds.length > (_max - 1) && _offset > 0) {
                _showPage(mcdu, _offset - 1);
            }
        };

        mcdu.onUp = () => {
            if (_offset < (_winds.length - (_max - 1))) {
                _showPage(mcdu, _offset + 1);
            }
        };

        return rows;
    }

    static ParseTrueWindAlt(_input) {
        const elements = _input.split('/');
        if (elements.length != 3) {
            return null;
        }

        let direction = parseInt(elements[0]);
        if (direction == 360) {
            direction = 0;
        }
        if (!isFinite(direction) || direction < 0 || direction > 359) {
            return null;
        }

        const speed = parseInt(elements[1]);
        if (!isFinite(speed) || speed < 0 || speed > 999) {
            return null;
        }

        const altitude = parseInt(elements[2]);
        if (!isFinite(altitude) || altitude < 0 || altitude > 390) {
            return null;
        }

        return {
            direction: direction,
            speed: speed,
            altitude: altitude
        };
    }

    static TryAddWind(mcdu, _windArray, _input, _showPage) {
        const data = CDUWindPage.ParseTrueWindAlt(_input);
        if (data == null) {
            mcdu.addNewMessage(NXSystemMessages.formatError);
        } else {
            _windArray.push(data);
            _showPage();
        }
    }

    static ParseWind(_input) {
        const elements = _input.split('/');
        if (elements.length != 2) {
            return null;
        }

        let direction = parseInt(elements[0]);
        if (direction == 360) {
            direction = 0;
        }
        if (!isFinite(direction) || direction < 0 || direction > 359) {
            return null;
        }

        const speed = parseInt(elements[1]);
        if (!isFinite(speed) || speed < 0 || speed > 999) {
            return null;
        }

        return {
            direction: direction,
            speed: speed
        };
    }
}
