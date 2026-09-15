# List & String Manipulation Cheat Sheet

| Objective | Operation | Example | Result |
| ------ | ------ | ---- | ------ |
| Head Address | `$list` | `$[1 2 3]` | `0x1000` |
| Length / Count | `\|list\|` | `\|1 2 3\|` | `3` |
| Prepend Element | `element list` | `0 [1 2 3]` | `[0 1 2 3]` |
| Append Element | `list element` | `[1 2 3] 4` | `[1 2 3 4]` |
| Get Head Element | `list ' 0` | `[1 2 3] ' 0` | `1` |
| Get Head Element | `0 @ list` | `0 @ [1 2 3]` | `1` |
| Get Tail Element | `list ' -1` | `[1 2 3] ' -1` | `3` |
| Get Tail Element | `-1 @ list` | `-1 @ [1 2 3]` | `3` |
| Get Rest (Tail List) | `list ' 1~` | `[1 2 3] ' 1~` | `[2 3]` |
| Get Rest (one element stays a list) | `list ' 2~` | `[1 2 3] ' 2~` | a list holding only `3` (`' 0` gives `3`) |
| Get Rest (Tail List) | `1~ @ list` | `1~ @ [1 2 3]` | `[2 3]` |
| Element At Index | `list ' index` | `[1 2 3] ' 1` | `2` |
| Element At Index | `index @ list` | `1 @ [1 2 3]` | `2` |
| Slice Range | `list ' [start ~ end]` | `[1 2 3 4] ' [1 ~ 3]` | `[2 3 4]` |
| Slice Range | `[start ~ end] @ list` | `[1 ~ 3] @ [1 2 3 4]` | `[2 3 4]` |
| Repeat Elements | `list * count` | `[0 1] * 3` | `[0 1 0 1 0 1]` |
| Lift Repeats | `list ^ count` | `[0 1] ^ 3` | `[[0 1] [0 1] [0 1]]` |
| Construct N-dim Matrix | `list , list` | `1 2 3 , 4 5 6` | `[[1 2 3],[4 5 6]]` |
| Concatenate Lists | `list1~ list2~` | `[1 2]~ [3 4]~` | `[1 2 3 4]` |
| Chunk List | `list / count` | `[1 2 3 4] / 2` | `[[1 2],[3 4]]` |
| Flatten List | `list~` | `[1 2,3 4]~` | `[1 2 3 4]` |
| Streamify 1D List | `list~` | `[1 2 3]~` | `1 2 3` |
| Reverse List | `><list` | `><[1 2 3]~` | `[3 2 1]` |
| Range Construction | `[start ~ end]` | `[1 ~ 5]` | `[1 2 3 4 5]` |
| Map (Pointfree) | `[pointfree,] list or stream` | `[* 2,] [1 2 3]~` | `[2 4 6]` |
| Filter (Pointfree) | `[pointfree,] list or stream` | `[< 3,] [1 2 3]~` | `[1 2]` |
| Fold (Pointfree) | `[pointfree] list or stream` | `[+] [1 2 3 4]~` | `10` |
