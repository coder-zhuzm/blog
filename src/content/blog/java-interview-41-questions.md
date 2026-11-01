---
title: 'Java 面试 41 问：从语言基础到并发与工程实践'
description: '按原理、追问和业务场景拆解 41 道 Java 面试题，配图讲清程序执行、引用与值传递、JVM 内存，以及 synchronized、volatile 与 CAS 的边界。'
pubDate: '2026-11-01'
tags: ['Java', '面试', 'JVM', '并发编程', '后端开发']
draft: false
---

把每题从“会背”讲到“能答”。每题按三层展开：<strong>深度解答</strong>（原理与关键细节）、<strong>面试追问</strong>（考官可能的下一问）、<strong>前后端业务场景</strong>（知识落到真实系统里怎么用）。建议先自己复述一遍，再看追问，最后把场景当例子讲给面试官，并主动把知识点和 Node / JS / Python 的前后端技术做对照，体现全栈视角。

> 示例以 Java 17 与 Spring Boot 3.x 的常见用法为背景，涉及 Java 21 虚拟线程等功能时单独标注版本。代码用于说明机制，省略部分导包、依赖注入和辅助类型，不是可以整体复制运行的完整项目；文中的账户示例仅用于解释封装，不承担生产支付或账务职责。

## 阅读路线

| 主题 | 题号 | 建议抓住的主线 |
| --- | --- | --- |
| 语言基础与运行原理 | 1–6 | 源码、字节码与 JVM 各自做什么 |
| 数据类型与运算符 | 7–14 | 值、引用、精度与表达式求值 |
| 控制流与数组 | 15–17 | 分支、遍历与容器边界 |
| 字符串 | 18–20 | 不可变性、内容比较与拼接成本 |
| 面向对象 | 21–28 | 对象职责、封装与动态分派 |
| 异常处理 | 29–30 | 异常分类与分层处理 |
| static、集合与泛型 | 31–33 | 共享状态、集合契约与类型安全 |
| JVM 与垃圾回收 | 34–35 | 内存区域、可达性与资源管理 |
| 并发编程 | 36–37 | 任务执行、可见性与原子性 |
| 框架原理与工程化 | 38–41 | 元数据、反射、构建与依赖管理 |

## Java 语言基础与运行原理

### 1. 后端语言特性与适用场景（Java 视角）

<strong>深度解答：</strong>Java 后端的主流模型是 <strong>Spring Boot MVC（多线程 + 阻塞 I/O）</strong>：默认平台线程配置下，Tomcat 工作线程在同步处理请求时通常持续占用；MVC 也支持异步请求处理，Java 21+ 配合相应配置还可使用虚拟线程，写起来直观，事务和团队协作都好维护，适合重业务逻辑、长生命周期的核心系统。对应的还有 <strong>Spring WebFlux（事件驱动 + 非阻塞 I/O）</strong>，基于 Reactor 用少量线程扛大量并发，适合网关、流式接口，但响应式编程模型复杂、排障成本高。横向对比：Node.js 强在事件循环、I/O 密集；Go 强在 Goroutine 的轻量并发；Java 的优势是生态成熟（Spring 全家桶、中间件兼容）、线程模型可控、JVM 调优手段多，劣势是启动慢、内存占用高。

```java
// Spring Boot MVC：一个请求占一个线程，同步阻塞
@RestController
public class OrderController {
    @GetMapping("/orders/{id}")
    public Order getOrder(@PathVariable Long id) {
        return orderService.findById(id);  // 线程在此等待数据库返回
    }
}

// Spring WebFlux：要求下游同样非阻塞；仅返回 Mono/Flux 并不能消除阻塞
@RestController
public class GatewayController {
    @GetMapping("/gateway/{id}")
    public Mono<Order> getOrder(@PathVariable Long id) {
        return orderService.findByIdAsync(id);
    }
}
```

- <strong>追问：</strong>什么场景该选 WebFlux 而不是 MVC？答：高吞吐网关、I/O 等待占比极高的接口（大量调下游、查缓存、读库）、需要背压控制的流式场景；若依赖 JDBC/JPA 等阻塞调用，不能直接放在事件循环线程上；内部管理后台、事务复杂的核心业务常优先考虑 MVC。

<strong>前后端业务场景：</strong>电商订单服务用 MVC 便于事务与团队协作；对外网关（鉴权、限流、转发）用 WebFlux 减少线程占用；AI 全栈项目里 Java 通常承担主业务后端，Node 承担 BFF 聚合前端请求，两者按 I/O 密集与业务复杂度分工。

### 2. JDK、JRE、JVM 分别是什么

<strong>深度解答：</strong>三者是包含关系：<strong>JVM</strong> 是 Java 虚拟机，负责执行字节码；<strong>JRE</strong> = JVM + 运行所需的核心类库，是运行环境；<strong>JDK</strong> = JRE + javac、javadoc、jar 等开发工具，是开发环境。Oracle 从 JDK 11 起不再提供对应版本的独立 JRE 下载；Temurin 等其他发行商仍可提供 JRE 镜像，需要精简运行时可用 jlink 裁剪，但日常开发仍装 JDK 即可覆盖“写、编、跑”全部需求。

```bash
java -version     # 查看运行时版本
javac -version    # JDK 自带的编译器
jlink --add-modules java.base --output mini-jre   # JDK9+ 裁剪精简运行时
```

- <strong>追问：</strong>只部署运行环境必须装 JDK 吗？答：现代做法是 Docker 基础镜像直接用精简 JRE（如 eclipse-temurin:17-jre），本地开发与 CI 装完整 JDK，两边环境保持一致更稳。

<strong>前后端业务场景：</strong>后端打镜像时选对基础镜像直接影响体积与启动速度；面试时可以用“JDK 是工具箱、JRE 是运行环境、JVM 是发动机”一句话收口。

### 3. 如何配置 JDK 环境变量

<strong>深度解答：</strong>配置两个关键变量：<strong>PATH</strong> 指向 JDK 的 bin 目录，让操作系统在任何目录都能找到 java、javac；<strong>JAVA_HOME</strong> 指向 JDK 安装根目录（不含 bin），供 Maven、Gradle、Tomcat、IDEA 等工具定位 JDK。配置后分别执行 java -version 与 javac -version 验证。Windows 在系统环境变量里配置；Linux/macOS 在 shell 配置文件中写入 export JAVA_HOME=... 与 export PATH=$JAVA_HOME/bin:$PATH。

```bash
# 写入 ~/.bashrc 或 /etc/profile.d/java.sh
export JAVA_HOME=/usr/lib/jvm/jdk-17
export PATH=$JAVA_HOME/bin:$PATH

java -version && javac -version   # 验证配置生效
```

- <strong>追问：</strong>只配 PATH 不配 JAVA_HOME 会怎样？答：命令行能用 java，但依赖 JAVA_HOME 的 Maven、Tomcat、IDE 可能报找不到 JDK，所以两者都要配。

<strong>前后端业务场景：</strong>CI 流水线（GitHub Actions / Jenkins）的构建镜像里同样要显式设置 JAVA_HOME，否则依赖该变量的启动脚本或工具可能找不到 JDK；是否能通过 PATH 回退查找，取决于具体工具。

### 4. java 和 javac 命令分别有什么作用

<strong>深度解答：</strong>javac 负责<strong>编译</strong>：把 .java 源文件编译成 .class 字节码；java 负责<strong>运行</strong>：启动 JVM，加载 class 并从 main 方法开始执行。运行时还要通过 classpath（-cp 参数或环境变量）找到依赖类。传统 class 启动模式下，java 后面传的是<strong>类名</strong>，不能写 java Hello.class。Java 11+ 还支持用 `java Hello.java` 直接运行单文件源码；这与运行已编译类是两种启动模式。

```java
public class Hello {
    public static void main(String[] args) {
        System.out.println("Hello Java");
    }
}
```

```bash
javac Hello.java    # 编译：生成 Hello.class（字节码）
java  Hello         # 运行：传类名，不带 .class 后缀
```

- <strong>追问：</strong>javac 编译报错和运行时抛异常有什么本质区别？答：编译期错误是语法或类型问题，运行期异常才是逻辑或环境问题，两者排查思路完全不同。

<strong>前后端业务场景：</strong>前端常问“后端部署的 jar 是什么”——java -jar app.jar 就是 JVM 读取 manifest 里指定的主类后启动应用；理解这条链路就能讲清从源码到线上服务的全过程。

### 5. 一个 Java 程序从源代码到最终运行经历了哪些过程

<strong>深度解答：</strong>完整链路分两段：<strong>编译期</strong>，javac 对 .java 做词法/语法分析、语义检查、类型检查，生成平台无关的 .class 字节码；<strong>运行期</strong>，JVM 启动后由类加载机制完成加载、链接（验证、准备、解析）与初始化；其中解析可按需延后，初始化也由特定使用行为触发，再交给执行引擎——解释器逐条执行字节码，<strong>JIT 即时编译器</strong>把高频执行的热点方法直接编译成本地机器码并缓存，这是 Java “越跑越快”的关键。进阶内容还包括分层编译（C1/C2）、逃逸分析、CDS 类数据共享、GraalVM AOT 提前编译等。

![Java 源码经 javac 编译为字节码，由目标平台 JVM 加载、链接、初始化并解释或 JIT 编译执行的链路](/images/java-interview-41/execution-flow.svg)

*字节码可跨兼容平台复用；解释器和 JIT 是运行时的两种执行机制，不是所有方法都必须先编译成本地码。*

```bash
javac Hello.java      # ① 编译期：源码 -> 字节码
java Hello            # ② 运行期：类加载 -> 解释执行 + JIT 编译热点
java -Xint Hello      # ③ 强制纯解释模式，可对比 JIT 的提速效果
```

- <strong>追问：</strong>JIT 和 AOT 有什么区别？答：JIT 在运行期按实际热点动态编译，保留跨平台与动态优化；AOT 提前编译成本地码，启动快、内存占用低，但失去部分跨平台与运行时优化能力。

<strong>前后端业务场景：</strong>微服务冷启动慢的根因之一就是 JIT 预热，生产上常用 CDS 或 AOT 优化启动时间；面试讲到这题，能把链路图完整讲出来本身就是加分项。

### 6. 为什么 Java 能做到 “一次编译，到处运行”

<strong>深度解答：</strong>因为 javac 产出的是<strong>平台无关的字节码</strong>，而不是 Windows、Linux 等操作系统直接执行的机器码。同一份 .class 在目标 JVM 支持其字节码版本、依赖与平台能力兼容的前提下，可以交给 Windows JVM、Linux JVM、macOS JVM 分别执行，由各平台 JVM 按 JVMS 规范把字节码翻译成当前平台的机器指令。关键在于：<strong>字节码跨平台，JVM 本身不跨平台</strong>，因为 JVM 必须调用操作系统提供的线程、内存、文件等能力。

```bash
javap -c Hello      # 反编译 .class，看到的就是平台无关的字节码
# 同一份字节码，Linux/Windows/macOS 的 JVM 各自翻译成本地指令
```

- <strong>追问：</strong>既然 JVM 不跨平台，那“到处运行”的价值是什么？答：业务代码只需编译一次，部署、迁移、多平台交付都免去重新编译，代价是每个平台都要有对应的 JVM 实现。

<strong>前后端业务场景：</strong>同一套 jar 在 Windows 本地调试、Linux 服务器运行、容器里部署，无需重新编译，这是后端“构建一次、处处部署”的基础，也是对比 Node/Python 解释执行、Go 直接编译成目标平台二进制时的关键差异。

## 数据类型与运算符

### 7. Java 中的基本数据类型

<strong>深度解答：</strong>Java 有 8 种基本数据类型，分成整数、浮点、字符、布尔四类。要点是记准位宽与范围。字段和数组元素有默认值，局部变量则必须先明确赋值再读取：

```java
byte b = 100;               // 1 字节，-128 ~ 127
short s = 30000;             // 2 字节
int count = 1_000_000;       // 4 字节，整数字面量默认 int
long total = 3_000_000_000L;  // 8 字节，超 int 范围必须加 L
float price = 99.9F;         // 4 字节，字面量必须加 F
double score = 99.5;         // 8 字节，小数字面量默认 double
char grade = 'A';            // 2 字节，单个 UTF-16 单元
boolean passed = true;       // 仅 true / false
```

|类型|字节数|范围 / 说明|
|---|---|---|
|byte|1|-128 ~ 127|
|short|2|-32768 ~ 32767|
|int|4|约 ±21 亿，整数字面量默认类型|
|long|8|大整数，字面量加 L|
|float|4|约 7 位有效数字，字面量加 F|
|double|8|约 15~16 位有效数字，小数字面量默认类型|
|char|2|0 ~ 65535，单个 UTF-16 代码单元|
|boolean|未规定|仅 true / false，规范未限定字节数|

- <strong>追问：</strong>boolean 为什么不规定占几个字节？答：Java 语言规范没有硬性规定，JVMS 对 boolean 数组提供专门支持，boolean 表达式运算常映射为 int 指令；这不等于所有对象字段或局部变量都固定占某个字节数，实际布局由 JVM 实现与优化决定。

<strong>前后端业务场景：</strong>数据库字段与 Java 类型映射是高频问题：int ↔ INTEGER、long ↔ BIGINT、double ↔ DOUBLE，映射错了会出现数据溢出或精度丢失（联动 Q9、Q10）。

### 8. 基本数据类型和引用数据类型的区别

<strong>深度解答：</strong>基本类型变量直接保存<strong>值</strong>；引用类型变量保存<strong>引用</strong>（用于访问对象，不等同于可操作的原始内存地址），指向堆中的对象。赋值时，基本类型复制值，两个变量互不影响；引用类型复制的是引用，两个变量可能指向同一个对象，通过一个变量修改对象，另一个变量也能看到。关键深化点：<strong>Java 只有值传递</strong>——对象传参时传的是“引用的副本”，方法内改引用指向不影响外部，但通过引用修改对象内容会生效。另外“基本类型一定在栈、对象一定在堆”并不严谨，HotSpot 的逃逸分析与标量替换可能消除对象分配，将其字段作为标量处理；这不等于把完整对象搬到栈上。

![方法参数接收对象引用的副本，修改对象内容影响共享对象，重新绑定参数不会改变调用方引用](/images/java-interview-41/reference-copy.svg)

*Java 始终按值传递。复制引用值与复制对象是两件事。图中箭头是概念上的引用关系，不表示实际内存地址或布局。*

```java
int a = 10;
int b = a;
b = 20;
System.out.println(a);      // 10：基本类型赋值是复制值

User u1 = new User("Tom");
User u2 = u1;               // 复制的是引用值
u2.name = "Jack";
System.out.println(u1.name); // Jack：两个变量指向同一对象
```

- <strong>追问：</strong>String 是基本类型吗？答：不是，String 是引用类型（final 类），这点和很多弱类型语言的直觉不同。

<strong>前后端业务场景：</strong>后端方法传对象入参时若直接修改入参对象会污染调用方，规范做法是复制对象或用只读视图；前端 JS 传对象时同样是传递引用值的副本，深浅拷贝面试题就是围绕这个机制展开。

### 9. int、long、float、double 区别

<strong>深度解答：</strong>int 与 long 都是整数，int 32 位、long 64 位，long 范围更大；float 与 double 都是浮点，float 32 位约 7 位有效数字，double 64 位约 15~16 位有效数字。字面量默认规则：整数默认 int，小数默认 double，所以 long 大数值要加 L（3000000000L），float 要加 F（3.14F）。浮点数是二进制近似表示，0.1 无法精确表达，<strong>金额、汇率等敏感计算不能用浮点</strong>，应使用 BigDecimal 或“分”这样的整数。

```java
int i = 2147483647;                 // int 最大值
long l = 9_223_372_036_854_775_807L; // long 范围大得多
float f = 3.14F;                    // 约 7 位有效数字
double d = 3.14159265358979;        // 约 15~16 位有效数字

// 金额不能用浮点：0.1 无法精确表示
System.out.println(0.1 + 0.2);      // 0.30000000000000004
BigDecimal money = new BigDecimal("99.90"); // 用字符串构造，避免精度损失
```

- <strong>追问：</strong>为什么 double 比 float 精确却还是不能算钱？答：精确是相对而言，两者都是二进制浮点，都有舍入误差；财务计算必须用 BigDecimal 或整数单位。

<strong>前后端业务场景：</strong>前端传订单金额给后端时，JS 的 Number 只能安全表示 `-(2^53 - 1)` 到 `2^53 - 1` 范围内的整数，超过范围的雪花 ID、大金额会丢精度——所以<strong>长整型 ID 前后端传输要用 String</strong>，这是全栈面试必考的前后端联动点。

### 10. 自动类型转换和强制类型转换

<strong>深度解答：</strong>小范围转大范围可<strong>自动隐式转换</strong>：byte → short → int → long → float → double（char 也可转 int）。大范围转小范围必须<strong>强制转换</strong>，可能截断小数或溢出：double 99.99 强转 int 得 99（截断而非四舍五入）；int 130 强转 byte 得 -126（溢出环绕）。注意 int → float 虽是拓宽，但大整数转 float 仍可能丢精度，因为浮点尾数有限。

```java
// 自动（隐式）转换：小范围 -> 大范围
int a = 100;
long b = a;         // int -> long
double c = b;       // long -> double

// 强制转换：大范围 -> 小范围，可能截断或溢出
double price = 99.99;
int result = (int) price;   // 99：小数被截断（不是四舍五入）
int big = 130;
byte small = (byte) big;    // -126：超出 byte 范围发生溢出
```

- <strong>追问：</strong>long → float 也是自动转换，为什么可能丢精度？答：自动转换只看“范围是否放得下”，不看精度；float 的有效二进制位数有限，大整数转换时可能丢失低位精度并发生舍入。

<strong>前后端业务场景：</strong>数据库自增 ID 超过 int 上限（约 21 亿）会溢出，所以高并发系统的主键设计必须用 BIGINT/long 或雪花 ID；前端传超大 number 也会触发 Q9 的精度问题，工程上统一转 String。

### 11. 整数除法赋给 double，最终输出什么？

```java
int a = 10;
int b = 3;

double result = a / b;

System.out.println(result); // 3.0

```

<strong>深度解答：</strong>输出 3.0 而不是 3.3333...。原因：a 和 b 都是 int，<strong>先执行整数除法得到 3</strong>，再把 3 转成 double 赋给 result。这就是“用 double 接收结果 ≠ 计算过程是 double 运算”。修复方式是把操作数先变成浮点：(double) a / b，或写成 a / 3.0。背后规则是<strong>二元数值提升</strong>：两个操作数中有一个是浮点，结果才是浮点。

- <strong>追问：</strong>a 是 int、b 是 double 时，a / b 的结果类型是什么？答：double，因为有浮点操作数参与。

<strong>前后端业务场景：</strong>统计接口算占比、均值、费率时，忘了转 double 会得到 0 或整数值，是最常见的隐性 bug；金额分摊则要用 BigDecimal.divide 并显式指定舍入模式，不能依赖除法默认行为。

### 12. Java 中 `==` 和 `equals()` 有什么区别

<strong>深度解答：</strong>基本类型用 == 比较<strong>值</strong>；引用类型用 == 比较<strong>引用地址</strong>（是否同一对象）。Object 的默认 equals() 本质上也是 ==（比较引用），String、Integer 等类<strong>重写</strong> equals() 后才变成按内容比较。因此判断对象内容相等要用 equals。核心延伸：<strong>重写 equals 必须重写 hashCode</strong>，否则 HashMap、HashSet 的查找与去重会失效——哈希集合先按哈希定位候选位置，再结合 equals 判断，equals 相等则 hashCode 必须相等。

```java
String s1 = new String("hello");
String s2 = new String("hello");
System.out.println(s1 == s2);        // false：比较引用地址
System.out.println(s1.equals(s2));   // true：String 重写后比较内容

Integer a = 200, b = 200;
System.out.println(a == b);          // 默认 HotSpot 通常为 false；缓存上限可调整
System.out.println(a.equals(b));     // true：包装类比较数值用 equals
```

- <strong>追问：</strong>只重写 equals 不重写 hashCode 会出什么问题？答：内容相同的两个对象 hashCode 不同，HashMap 里放进去后 get 不到，Set 去重也失效。

<strong>前后端业务场景：</strong>后端实体做去重、作为 Map 的 key、放进 Set 时都要遵守 equals/hashCode 契约；前端 JS 没有 equals，对象比较要靠深比较或序列化，这个差异本身就是全栈面试的好话题。

### 13. `i++` 和 `++i` 有什么区别

<strong>深度解答：</strong>单独使用时两者等价，都让 i 加 1；参与表达式时：<strong>i++ 先用旧值、后加 1</strong>，<strong>++i 先加 1、后用新值</strong>。例：int i = 10; int a = i++; 得 a=10、i=11；int a = ++i; 得 a=11、i=11。字节码层面对应 iinc 指令与取值顺序的差异。工程建议：不要在复杂表达式或方法参数里写 i++ 这种副作用写法，可读性差且易错。

```java
int i = 10;
int x = i++;      // x = 10（先用旧值），i 变为 11

int j = 10;
int y = ++j;      // j 先变为 11，y = 11（再用新值）

// 独立语句时两者等价，只在参与表达式时有区别
```

- <strong>追问：</strong>for 循环里 i++ 和 ++i 有性能差异吗？答：现代编译器下基本没有，习惯上写 ++i 即可。

<strong>前后端业务场景：</strong>代码评审高频关注点：arr[i++] 这类写法不要出现在方法参数里；涉及计数（库存、点击数）时不要依赖 ++，应使用 AtomicInteger 或数据库/Redis 原子操作（联动 Q37）。

### 14. `&&` 和 `&`、`||` 和 `|` 有什么区别，什么是短路运算

<strong>深度解答：</strong>&& 和 || 具有<strong>短路</strong>特性：左边已能决定整个表达式结果时，右边不再执行。& 和 | 用于布尔表达式时左右两边都会执行，且同时是整数的<strong>位运算</strong>运算符（按位与、按位或）。例：if (a &gt; 5 || ++a &gt; 20) 中 a&gt;5 已为 true，++a 不会执行；换成 | 则 ++a 会执行。短路最大的价值是<strong>防 NPE</strong>：obj != null && obj.size() &gt; 0，左边为 false 时右边不会被调用。

```java
String name = null;
// 短路：name != null 为 false，右边不再执行，避免 NPE
if (name != null && name.length() > 0) {
    System.out.println(name.length());
}

int a = 10;
if (a > 5 || ++a > 20) { }  // a 仍为 10：左边已 true，右边不执行
if (a > 5 | ++a > 20) { }   // a 变为 11：| 不短路，两边都执行
```

- <strong>追问：</strong>短路会带来什么隐蔽 bug？答：右侧若带副作用（方法调用、自增），结果成立时副作用不执行，代码逻辑可能和预期不符。

<strong>前后端业务场景：</strong>前端 JS 的 && / || 同样会短路，但返回的是某个操作数；Java 的 && / || 要求布尔操作数，结果也是 boolean；后端多条件过滤、判空后再取属性的场景高频使用短路写法，写对判空顺序就是最实在的防 NPE 手段。

## 控制流与数组

### 15. if 和 switch 有什么区别，分别适合什么场景

<strong>深度解答：</strong>if 适合<strong>范围判断、多条件组合</strong>（成绩区间、权限组合、复杂布尔表达式）；switch 适合<strong>针对单个值的离散等值分支</strong>（星期、状态码、渠道）。switch 支持 int、char、枚举、String；传统冒号式 case 若不希望继续执行后续分支，需要用 break 等方式退出，Java 14+ 的 switch 表达式用箭头语法（-&gt;）天然无穿透，还能用 yield 返回值。性能上编译器会优化为 tableswitch（密集值）或 lookupswitch（稀疏值）。

```java
// if：范围判断、多条件组合
int score = 85;
if (score >= 90) System.out.println("优秀");
else if (score >= 60) System.out.println("及格");
else System.out.println("不及格");

// switch 表达式（Java 14+）：箭头语法无穿透，可返回值
String level = switch (score / 10) {
    case 9, 10 -> "优秀";
    case 6, 7, 8 -> "及格";
    default -> "不及格";
};
```

- <strong>追问：</strong>大量 if-else 和 switch 怎么选？答：分支条件复杂或涉及范围用 if；单一变量多等值分支用 switch 更清晰；再多可以用策略模式或枚举行为替代（联动 Q26）。

<strong>前后端业务场景：</strong>订单状态机流转、消息类型分发用 switch + 枚举非常清晰；前端 JS 处理按钮类型、消息类型时同理，且 JS 的 switch 也是等值比较（严格 ===）。

### 16. for、while、do while 有什么区别，break 和 continue 有什么区别

<strong>深度解答：</strong>for 适合<strong>次数已知</strong>；while 适合<strong>只知道条件、不知道次数</strong>；do-while 先执行一次循环体再判断，<strong>至少执行一次</strong>。break 结束<strong>整个</strong>循环；continue 跳过<strong>当前这一轮</strong>继续下一轮。嵌套循环可用带标签的 break 跳出外层。深化点：for-each 遍历 Iterable 时通常使用 Iterator，遍历数组时则使用索引。对 ArrayList 等集合，在迭代器之外做结构修改可能触发 fail-fast 的 ConcurrentModificationException，但并非所有集合或修改都必然抛出该异常，应使用 Iterator.remove() 或先收集再统一删除。

```java
for (int i = 0; i < 5; i++) { }   // 次数已知

int n = 0;
while (n < 5) { n++; }              // 条件驱动

int m = 10;
do { System.out.println("至少执行一次"); } while (m < 5);

// break 结束整个循环，continue 跳过本轮
for (int i = 1; i <= 5; i++) {
    if (i == 2) continue;    // 跳过 2
    if (i == 4) break;       // 到 4 结束
    System.out.print(i);     // 输出 13
}

// 陷阱：对 ArrayList 等集合，for-each 中直接结构修改可能触发异常
// for (String s : list) list.remove(s);  // ConcurrentModificationException
```

- <strong>追问：</strong>for-each 里能安全删除元素吗？答：对 ArrayList 等集合直接 list.remove 可能触发并发修改异常；不要依赖异常来保证正确性；用 Iterator 的 remove 或收集待删项在循环外删除。

<strong>前后端业务场景：</strong>批量处理大列表（每 1000 条一批提交）、轮询等待任务完成（while + 超时上限防止死循环）、遍历中按条件剔除脏数据，都是这三类循环的实际落点。

### 17. Java 数组如何定义和初始化，数组有哪些特点

<strong>深度解答：</strong>数组保存<strong>一组相同类型</strong>的数据，特点：长度创建时确定、不可动态改变；下标从 0 开始；通过下标访问是 O(1) 的随机访问；越界抛 ArrayIndexOutOfBoundsException。三种初始化方式：new int[3]（默认值）、new int[]{10, 20, 30}、字面量 {10, 20, 30}。引用类型数组存的是引用；多维数组本质是数组的数组。需要扩容时要新建数组并拷贝（Arrays.copyOf）。

```java
int[] arr = new int[3];              // 默认值 0
int[] arr2 = new int[]{10, 20, 30};
int[] arr3 = {10, 20, 30};

System.out.println(arr3[0]);        // 10：下标从 0 开始
System.out.println(arr3.length);    // 3：长度固定
// arr3[3] 访问越界会抛 ArrayIndexOutOfBoundsException

// 扩容需新建数组再拷贝
int[] bigger = Arrays.copyOf(arr3, 6);
```

- <strong>追问：</strong>数组和 ArrayList 怎么选？答：长度固定、追求极致性能用数组；绝大多数业务场景用 ArrayList，它内部就是数组加自动扩容。

<strong>前后端业务场景：</strong>固定长度的业务桶（如 24 小时统计桶、星期数组）用数组最合适；前端 JS 的数组是动态的，概念上更像 ArrayList，讲清这个对照能体现对两种语言的底层理解。

## 字符串

### 18. String 为什么是不可变对象

<strong>深度解答：</strong>String 是 final 类，内部 value 不可修改（JDK 8 是 char[]，JDK 9+ 改为 byte[] + coder 实现压缩字符串），且没有暴露修改入口，所以对象一旦创建内容就固定。拼接操作看似修改，实际是得到另一个字符串结果，再让变量指向它；常量折叠等优化可能消除运行期分配。不可变的好处：可以安全地被<strong>字符串常量池</strong>复用；天然线程安全；hashCode 可以缓存（HashMap 的 key 常用 String）；不可变性也能避免共享字符串内容被意外修改；但并不提供输入校验、SQL 注入防护或 URL 安全保证。

```java
String str = "hello";
str = str + " world";    // 不是修改原对象，而是创建新 String
System.out.println(str); // hello world

// 对比：StringBuilder 修改内部缓冲区；扩容和 toString 仍可能分配对象
StringBuilder sb = new StringBuilder("hello");
sb.append(" world");
String result = sb.toString();
```

- <strong>追问：</strong>字符串常量池在哪里？答：JDK 7 之前放在方法区（永久代），JDK 7 之后移到堆中。

<strong>前后端业务场景：</strong>缓存 key 大量拼接时用 StringBuilder；拼接 SQL 有注入风险，要用 PreparedStatement 参数化，字符串不可变并不能防止 SQL 注入；日志里大量 + 拼接会频繁创建对象，高并发日志链路要换 StringBuilder 或占位符。

### 19. String、StringBuilder、StringBuffer 的区别

<strong>深度解答：</strong>String 不可变，内容变化时需要另一个字符串结果；StringBuilder 可变、不提供内置同步，常用于单线程或线程封闭的累积拼接；StringBuffer 的相关方法提供同步，但多次调用组成的复合操作仍可能需要外部同步，实际性能应测量。注意：JDK 8 的 javac 通常把运行期 + 拼接编译成 StringBuilder.append；JDK 9+ 默认改用 invokedynamic 与 StringConcatFactory。无论采用哪种实现，<strong>循环里累积拼接不可变 String 都可能反复复制已有内容</strong>，因此大量循环拼接优先用 StringBuilder；常量表达式则可能在编译期直接折叠。

```java
// 正确：循环拼接用 StringBuilder 原地追加
StringBuilder sb = new StringBuilder();
for (int i = 0; i < 10000; i++) {
    sb.append(i);
}
String result = sb.toString();

// 错误：循环里用 + 拼接，每次都会 new 一个新 String
String s = "";
for (int i = 0; i < 10000; i++) {
    s += i;   // 性能差，产生大量中间对象
}
```

- <strong>追问：</strong>什么时候才需要 StringBuffer？答：多线程共享同一个可变字符串对象的场景极其罕见；现代代码基本用 StringBuilder 配合局部变量，避免跨线程共享可变构建器。

<strong>前后端业务场景：</strong>导出 CSV、组装大 JSON、批量生成 SQL、拼接大日志文本，都是 StringBuilder 的典型场景；一次拼大字符串和循环里逐次 +，性能差异可达数量级，这是能现场写代码证明的加分点。

### 20. String 中 == 和 equals 的区别

<strong>深度解答：</strong>经典考点：String a = "hello"; String b = "hello"; a == b 为 true，因为<strong>字符串字面量进入常量池</strong>，两个引用指向同一个池中对象；而 new String("hello") 会创建新对象，两次 new 的 == 为 false，equals 为 true（String 重写了内容比较）。进一步可以提 intern()：手动把字符串放入常量池，返回池中对象，用于省内存，但生产上要谨慎使用。

```java
String a = "hello";      // 字面量进字符串常量池
String b = "hello";
System.out.println(a == b);        // true：指向池中同一对象

String c = new String("hello");
System.out.println(a == c);        // false：new 创建新对象
System.out.println(a.equals(c));   // true：equals 比较内容

System.out.println(a == c.intern()); // true：intern 返回池中对象
```

- <strong>追问：</strong>intern() 的适用场景？答：大量重复字符串驻留可显著省内存（需确认重复率与驻留成本），但池中字符串并非永不回收；驻留会带来查表、维护与内存成本，应先测量重复率和收益。

<strong>前后端业务场景：</strong>前端传来的字符串参数比较一律用 equals（或 Objects.equals），避免 == 陷阱；状态码、渠道码这类<strong>字面量常量</strong>用 == 和常量池对象比较是安全的，但团队规范通常统一要求 equals，减少心智负担。

## 面向对象

### 21. Java 中的包装类是什么，为什么需要包装类

<strong>深度解答：</strong>8 种基本类型各有包装类：Byte、Short、Integer、Long、Float、Double、Character、Boolean。需要包装类的原因：泛型和集合只能装对象（ArrayList&lt;Integer&gt; 不能写 int）；需要 null 表达“无值”；很多 API 要求对象。配套机制是<strong>自动装箱 / 拆箱</strong>。两个高频坑：一是 <strong>Integer 缓存 -128~127</strong>，规范保证的装箱常量范围内可共享对象；范围外也可能缓存，不能用 == 判断数值相等，比较包装类数值要用 equals；二是<strong>自动拆箱 NPE</strong>：Long l = null; long x = l; 直接空指针。

```java
Integer a = 100, b = 100;
System.out.println(a == b);     // true：-128~127 有缓存
Integer c = 200, d = 200;
System.out.println(c == d);     // 默认 HotSpot 通常为 false；上限可调整
System.out.println(c.equals(d)); // true：比较数值用 equals

// 自动拆箱 NPE 陷阱
Long id = null;
long rawId = id;                // 运行期 NullPointerException
```

- <strong>追问：</strong>为什么 Integer 缓存范围是 -128~127？答：JLS 规定该范围必须缓存，HotSpot 默认 -128~127，上限可通过启动参数调整。

<strong>前后端业务场景：</strong>数据库 bigint 映射 Long；DTO 字段用包装类可以区分“前端没传（null）”与“传了 0”，这个语义在参数校验和更新逻辑里非常关键；Redis 存取对象时也要注意包装类型的序列化一致性。

### 22. Java 中的类和对象

<strong>深度解答：</strong>类是<strong>模板</strong>（描述属性和行为），对象是<strong>实例</strong>（模板的具体数据）。通过 new 调用构造器创建对象，引用语义让多个变量可以指向同一对象。Java 对象有确定的运行时类型，可由普通类、匿名类等创建；业务数据通常用显式定义的类或 record 表达，这与 JS 的对象字面量不同。工程上对象通常按职责分层：Entity（持久化）、DTO（传输）、VO（展示），并做显式转换。

```java
class User {
    String name;
    int age;

    User(String name, int age) {   // 构造器：new 时执行
        this.name = name;
        this.age = age;
    }
}

User user1 = new User("Tom", 18);   // 模板 -> 具体实例
User user2 = new User("Jack", 20);
```

- <strong>追问：</strong>为什么需要 DTO 而不是直接把 Entity 返回给前端？答：Entity 可能携带敏感字段、与表结构强耦合，DTO 作为传输契约隔离数据库变化对接口的影响。

<strong>前后端业务场景：</strong>前端 JS 常用对象字面量，后端常用明确的 DTO/VO（动态结构也可用 Map 或 JSON 树）——接口返回结构（VO）的设计直接影响前端取值；前后端联调的分歧大多出在“字段该由谁定义、叫什么名”，这是全栈视角的高频话题。

### 23. 什么是封装，Java 为什么需要封装

<strong>深度解答：</strong>封装是隐藏内部实现细节，只暴露必要的受控访问方式：字段用 private，对外提供方法。价值：<strong>保护数据完整性</strong>（外部不能随意改坏状态）、<strong>隐藏复杂度</strong>、<strong>降低耦合</strong>（内部实现可换而不影响调用方）、方法内部可以做<strong>参数校验与业务规则</strong>。注意：只写 getter/setter 不算充分封装，真正的封装是把业务规则放进方法（如存款必须大于 0）。

```java
// 单线程封装示例；多线程和持久化场景还需并发控制与事务。
class Account {
    private BigDecimal balance = new BigDecimal("0.00");

    private static BigDecimal positiveMoney(BigDecimal money) {
        Objects.requireNonNull(money, "金额不能为空");
        BigDecimal normalized = money.setScale(2, RoundingMode.UNNECESSARY);
        if (normalized.signum() <= 0) {
            throw new IllegalArgumentException("金额必须大于 0");
        }
        return normalized;
    }

    public void deposit(BigDecimal money) {
        balance = balance.add(positiveMoney(money));
    }

    public boolean withdraw(BigDecimal money) {
        BigDecimal amount = positiveMoney(money);
        if (amount.compareTo(balance) > 0) return false;
        balance = balance.subtract(amount);
        return true;
    }

    public BigDecimal getBalance() { return balance; }
}
```

- <strong>追问：</strong>字段全部 private 就一定是好的封装吗？答：不一定，还要看是否把约束与行为放进方法；贫血模型和充血模型的讨论就源于此。

<strong>前后端业务场景：</strong>账户余额只允许 deposit / withdraw 方法修改，订单状态只允许 pay / cancel 方法流转，外部不能直接改字段——封装和状态机有助于维护对象内部规则；跨请求、跨进程的一致性还需要数据库约束、事务和并发控制；前端组件也靠封装 props 和内部 state 隔离实现细节。

### 24. 什么是继承，Java 为什么需要继承

<strong>深度解答：</strong>继承（extends）让子类复用父类的属性和方法，是代码复用、方法重写与多态的基础。Java 类是<strong>单继承</strong>，一个类只能有一个直接父类，但可以实现多个接口。若构造器没有显式调用 this(...) 或 super(...)，编译器会插入 super()；父类没有可访问的无参构造器时，需要显式调用合适的父类构造器。深化点：<strong>组合优于继承</strong>——继承破坏封装、耦合父类实现，应优先用组合（持有引用）；里氏替换原则要求子类能替换父类而不破坏行为。

```java
class Animal {
    String name;
    void eat() { System.out.println("吃东西"); }
}

class Dog extends Animal {          // 单继承
    void bark() { System.out.println("汪汪"); }
}

Dog dog = new Dog();
dog.name = "旺财";    // 复用父类字段
dog.eat();           // 复用父类方法
dog.bark();
```

- <strong>追问：</strong>为什么 Java 不支持多继承？答：多继承会带来菱形问题和方法歧义；用接口组合能力是更安全的替代。

<strong>前后端业务场景：</strong>支付渠道抽象类把“参数校验、签名、回调处理”等公共骨架放父类，支付宝/微信/银行卡各自实现差异部分；统一响应对象、统一异常基类也是继承在工程里的常见形态。

### 25. Java 重写和重载的区别

<strong>深度解答：</strong>重写（Override）：<strong>子类重新实现父类的同签名方法</strong>，发生在父子类之间，运行期动态绑定，加 @Override 让编译器校验；重载（Overload）：<strong>同名方法、参数列表不同</strong>（可以定义在同一类，也可包含继承的方法）（个数/类型/顺序），编译期静态绑定，与返回值无关。一句话：重写是“换实现”，重载是“多形态的入口”。

```java
class Animal {
    void speak() { System.out.println("动物叫"); }
}
class Dog extends Animal {
    @Override                       // 重写：父子类之间，同签名
    void speak() { System.out.println("汪汪"); }
}

class Printer {
    void print(String s) {}                // 重载：同名，参数不同
    void print(int n) {}
    void print(String s, int n) {}
}
```

- <strong>追问：</strong>重载能只靠返回值区分吗？答：不能，调用时编译器无法仅凭返回值确定该调哪个方法。

<strong>前后端业务场景：</strong>DTO 转换方法重载（toDTO(User)、toDTO(List&lt;User&gt;)）让调用方按入参自然选择；前端 JS 没有重载，同名函数会被后者覆盖，通常用默认参数或参数对象模拟——这是 Java 与 JS 的一个典型语言差异点。

### 26. 什么是多态，Java 多态是如何实现的

<strong>深度解答：</strong>多态是<strong>父类型引用指向子类对象，调用同一个方法表现出不同行为</strong>。成立条件：继承或接口关系 + 子类重写方法 + 父类型引用指向子类对象。实现机制是<strong>运行期动态分派</strong>：JVM 根据对象实际类型选择实现；HotSpot 可使用虚方法表、接口方法表等机制，JIT 也可能进行去虚拟化与内联优化。价值是<strong>面向接口/抽象编程</strong>——调用方只依赖抽象，新增实现不需要改调用代码，是策略模式、Spring 多实现注入的基础。

```java
class Animal { void speak() {} }
class Dog extends Animal {
    @Override void speak() { System.out.println("汪汪"); }
}
class Cat extends Animal {
    @Override void speak() { System.out.println("喵喵"); }
}

Animal a1 = new Dog();    // 父类型引用指向子类对象
Animal a2 = new Cat();
a1.speak();               // 运行期分派：汪汪
a2.speak();               // 喵喵

// 面向抽象编程：新增子类不用改调用方
void letSpeak(Animal animal) { animal.speak(); }
```

- <strong>追问：</strong>多态和重载的区别？答：多态是运行期按对象实际类型分派；重载是编译期按参数静态确定，两者机制完全不同。

<strong>前后端业务场景：</strong>支付策略接口 PayService 有 AlipayService、WechatService 多个实现，工厂按渠道码取实现，新增一个渠道只加实现类不动调用方；Spring 注入接口多实现时用 @Qualifier 或 @Primary 区分。

### 27. Java 中接口和抽象类有什么区别

<strong>深度解答：</strong>定位不同：<strong>抽象类描述“是什么”</strong>——可以有状态（成员变量）、构造器、已实现方法、抽象方法，用 extends 单继承；<strong>接口描述“能做什么”</strong>——能力契约，用 implements 多实现。现代 Java 接口也可以有 default、static（Java 8）、private（Java 9）方法，还能做函数式接口（@FunctionalInterface）。选型：共享骨架流程用抽象类（模板方法模式）；定义能力契约、需要多实现用接口。

```java
abstract class Animal {        // 抽象类：描述“是什么”
    String name;                // 可以有状态
    abstract void speak();      // 抽象方法
    void eat() { System.out.println("吃东西"); }  // 已实现方法
}

interface Flyable {             // 接口：描述“能做什么”
    void fly();
}

class Duck extends Animal implements Flyable {
    @Override void speak() { System.out.println("嘎嘎"); }
    @Override public void fly() { System.out.println("飞"); }
}
```

- <strong>追问：</strong>接口有 default 方法后，和抽象类的界限在哪？答：接口仍不能持有实例状态（字段是常量），抽象类可以；所以“状态 + 骨架”选抽象类，“契约 + 能力”选接口。

<strong>前后端业务场景：</strong>Spring 的 Service 层“接口 + Impl”用接口定义契约，方便 AOP 代理与测试 mock；登录校验模板（抽象类）把“校验→验证→记录日志”公共流程固定，子类实现验证差异，这就是模板方法模式。

### 28. Java 中 final、finally 有什么区别

<strong>深度解答：</strong>final 是<strong>关键字</strong>：修饰变量（不可重新赋值；引用类型指引用不可变，对象内容可变）、修饰方法（不可重写）、修饰类（不可继承，如 String）。finally 是<strong>异常处理块</strong>：在正常控制流和异常传播过程中通常都会执行，用于资源清理；但 JVM 被终止（如 System.exit 或进程被强制结束）等情况下无法保证执行。finalize 是 Object 的废弃方法，执行时机不可靠，不能用于释放资源。深化点：Java 7+ 的 <strong>try-with-resources</strong> 可以自动关闭实现 AutoCloseable 的资源；finally 里写 return 会覆盖 try 的返回值或异常，属于坏味道。

```java
final class Config {          // final 类不可继承
    final int maxRetry = 3;    // final 变量不可重新赋值
}

// finally：正常控制流与异常传播过程中执行；进程终止等情况除外
try {
    int r = 10 / 2;
} catch (Exception e) {
    log.error("操作失败", e);
} finally {
    System.out.println("执行清理逻辑");
}

// 推荐 try-with-resources：自动关闭，无需手动 finally
try (FileInputStream in = new FileInputStream("a.txt")) {
    byte[] data = in.readAllBytes();
}
```

- <strong>追问：</strong>finally 里 return 有什么问题？答：finally 一旦执行到 return，就会覆盖 try 里的返回值，甚至掩盖异常，应该避免在 finally 里写 return。

<strong>前后端业务场景：</strong>文件流、JDBC 连接等 AutoCloseable 资源可用 try-with-resources 自动管理；ReentrantLock 等锁通常在 lock() 后，用 try/finally 中的 unlock() 释放；Spring 事务由框架统一提交/回滚，业务代码不需要手写 finally 控制。

## 异常处理

### 29. Java 中什么是异常，Exception 和 Error 有什么区别

<strong>深度解答：</strong>Throwable 是根类，下分 <strong>Error</strong> 与 <strong>Exception</strong>（注意：Error 不继承 Exception）。Error 是 JVM/环境级严重问题（OutOfMemoryError、StackOverflowError、NoClassDefFoundError），通常不可恢复，<strong>不应该用业务 try-catch 去捕获</strong>，交给运维处理（扩容、重启、排查泄漏）。Exception 是程序可以处理或需要关注的问题：IOException、SQLException 等受检异常，以及 RuntimeException 及其子类（NullPointerException、ArithmeticException、ClassCastException、IndexOutOfBoundsException 等）。

```java
// RuntimeException：编译不报错，运行期暴露（逻辑问题）
String s = null;
s.length();              // 运行期抛 NullPointerException

// 受检异常：编译器强制处理
try {
    new FileInputStream("a.txt");    // FileNotFoundException
} catch (FileNotFoundException e) {
    log.error("文件不存在", e);
}

// Error：系统级问题，不用业务代码捕获
// OutOfMemoryError、StackOverflowError -> 交给运维处置
```

- <strong>追问：</strong>OutOfMemoryError 能被 catch 住吗？答：语法上能，但内存已耗尽，普通业务代码通常无法安全恢复；是否隔离失败任务、退出进程，要按系统设计判断，排查时应区分堆、元空间、直接内存和线程等资源问题。

<strong>前后端业务场景：</strong>线上监控要区分两类告警：OOM 等 Error 走运维处置（扩容、重启、dump 分析），业务异常走研发修复；统一错误码体系把异常映射成前端可读的 code + message。

### 30. Java 中 checked exception 和 unchecked exception 有什么区别

<strong>深度解答：</strong>受检异常（checked）编译器<strong>强制</strong>要求捕获或 throws 声明，如 IOException、SQLException、FileNotFoundException，多来自外部环境（文件、网络、数据库）。非受检异常（unchecked）包括 RuntimeException 及其子类，以及 Error 及其子类，编译器不强制处理，如 ArithmeticException、NullPointerException——它们多是<strong>代码逻辑问题</strong>，应该修逻辑而不是到处 try-catch。现代 Java 实践的趋势：<strong>业务异常继承 RuntimeException</strong>，在合适的层由全局异常处理器统一收口（Spring 的 @RestControllerAdvice），避免每层都 try-catch 产生模板代码和吞异常。

```java
// 业务异常继承 RuntimeException，编译器不强制 catch
public class BizException extends RuntimeException {
    private final String code;
    public BizException(String code, String message) {
        super(message);
        this.code = code;
    }
    public String getCode() { return code; }
}

// 业务代码直接抛出，不层层 try-catch
if (stock < quantity) {
    throw new BizException("STOCK_NOT_ENOUGH", "库存不足");
}

// 全局异常处理器统一转响应（Spring）
@RestControllerAdvice
class GlobalExceptionHandler {
    @ExceptionHandler(BizException.class)
    public Result<?> handle(BizException e) {
        return Result.fail(e.getCode(), e.getMessage());
    }
}
```

- <strong>追问：</strong>为什么社区倾向少用受检异常？答：强制处理导致大量无意义 catch 和 throws 污染签名，异常被“处理”掉反而掩盖问题；运行时异常 + 全局处理更利于职责分层。

<strong>前后端业务场景：</strong>后端抛自定义业务异常（如“库存不足”“订单已关闭”），全局异常处理器统一转成 {code, message} 响应；前端 axios 拦截器按 code 统一提示或跳转——这就是“统一异常处理机制”的前后端完整闭环，也是本题最值得讲的落地表达。

## static、集合与泛型

### 31. Java 中 static 有什么作用，静态成员和普通成员有什么区别

<strong>深度解答：</strong>static 表示成员<strong>属于类本身</strong>而非某个对象：静态变量（类共享一份，如计数器）、静态方法（不依赖实例，如工具方法）、静态代码块（类初始化时执行）、静态内部类。区别：普通成员属于对象，每个对象一份；静态成员属于类，所有对象共享。静态方法<strong>不能直接访问实例成员</strong>（调用时可能没有对象）。深化点：<strong>静态可变状态有线程安全问题</strong>，多线程读写共享静态变量需要同步或原子类。

```java
class User {
    static int count = 0;     // 类级共享，所有对象共用一份
    String name;

    User(String name) {
        this.name = name;
        count++;
    }
}

new User("Tom");
new User("Jack");
System.out.println(User.count);   // 2：通过类名访问

// 并发下的静态计数器要用原子类
class SafeCounter {
    static final AtomicInteger COUNT = new AtomicInteger();
}
```

- <strong>追问：</strong>静态变量线程安全吗？答：共享但无内置同步，并发读写会出问题；计数器要用 AtomicInteger，配置类只读则安全。

<strong>前后端业务场景：</strong>全局常量类（状态码、渠道枚举值）、静态工具类（StringUtils、DateUtils）是常规用法；但<strong>静态集合只增不减会撑爆内存</strong>（联动 Q35），是内存泄漏排查的第一嫌疑点。

### 32. Java 的集合 List、Set、Map 有什么区别

<strong>深度解答：</strong>List 有序、可重复：ArrayList（数组实现，随机访问快、尾部增删快）、LinkedList（链表实现，头尾增删快）。Set 不允许重复：HashSet（基于 HashMap，靠 equals/hashCode 去重）、TreeSet（按自然顺序/比较器排序）、LinkedHashSet（保持插入顺序）。Map 存键值对、key 不可重复：HashMap（数组+链表/红黑树，无序）、TreeMap（key 有序）、ConcurrentHashMap（线程安全）。核心契约：放入 HashSet / 作为 HashMap 的 key，对象必须正确重写 equals 与 hashCode。

```java
List<String> list = new ArrayList<>();
list.add("Java"); list.add("Java");
System.out.println(list.size());        // 2：有序、可重复

Set<String> set = new HashSet<>();
set.add("Java"); set.add("Java");
System.out.println(set.size());         // 1：不可重复（hashCode + equals）

Map<String, Integer> map = new HashMap<>();
map.put("Tom", 18);
map.put("Jack", 20);
System.out.println(map.get("Tom"));     // 18：key 不可重复
```

- <strong>追问：</strong>HashSet 底层怎么去重？答：先算 hashCode 定位桶，再对桶内元素用 equals 判断；所以 equals 与 hashCode 必须一致。

<strong>前后端业务场景：</strong>订单号去重、标签去重用 Set；购物车用 Map&lt;skuId, 数量&gt;；按分数分组可用 TreeMap&lt;分数, 用户列表&gt;；若直接以分数为唯一 key，相同分数会覆盖，需要处理并列排名；前端 JS 的 Set/Map 概念同源（ES6），讲清对应关系能体现全栈功底。

### 33. Java 泛型是什么，为什么需要泛型

<strong>深度解答：</strong>泛型是在定义类/接口/方法时暂不确定类型、使用时再指定，核心价值是<strong>编译期类型安全</strong>：List&lt;String&gt; 只能放 String，放错类型编译就报错，省去强转，避免运行期 ClassCastException。底层是<strong>类型擦除</strong>：类型参数在编译后被擦除为上界或 Object；泛型签名仍可保留供反射读取，编译器也会插入必要的类型转换。不同类型实参通常共享同一个实现类。因此有擦除限制：不能 new T()、不能 instanceof T、泛型数组受限，编译器会生成桥方法保证多态。进阶用法：通配符 ? extends T（上界，适合读）、? super T（下界，适合写）。

```java
// 统一返回结构：泛型类
public class Result<T> {
    private int code;
    private T data;

    public static <T> Result<T> ok(T data) {
        Result<T> r = new Result<>();
        r.code = 0;
        r.data = data;
        return r;
    }
}

Box<String> box = new Box<>();   // 使用时才确定类型
box.set("Java");
String v = box.get();            // 取出来无需强转

// 类型擦除限制：运行时不知道 T 是什么
// T t = new T();  // 编译报错
```

- <strong>追问：</strong>List&lt;String&gt; 和 List&lt;Integer&gt; 运行时是同一个类吗？答：是，例如 new ArrayList&lt;String&gt;() 与 new ArrayList&lt;Integer&gt;() 的 getClass() 都返回 ArrayList.class；List 是接口，不是这些对象的具体运行时类，这也是泛型无法用于重载区分的底层原因。

<strong>前后端业务场景：</strong>统一返回 Result&lt;T&gt;、分页 Page&lt;T&gt;、通用 BaseMapper&lt;T&gt; 是后端最普遍的泛型实践；前端 TypeScript 的泛型与 Java 泛型概念对应，TS 的泛型和类型标注在生成 JavaScript 时同样被擦除；TS 主要采用结构类型系统，而 Java 主要采用名义类型系统，这与是否擦除是两个不同维度，讲清两者差异很加分。

## JVM 与垃圾回收

### 34. JVM 运行时内存区域主要有哪些

<strong>深度解答：</strong>口诀“私有两栈一计数，共享一堆一方法区”：线程私有的<strong>程序计数器</strong>（记录当前执行位置；JVMS 未为该区域规定 OutOfMemoryError 条件）、<strong>虚拟机栈</strong>（方法调用对应栈帧，存局部变量表、操作数栈，递归过深抛 StackOverflowError）、<strong>本地方法栈</strong>（native 方法）；线程共享的<strong>堆</strong>（对象实例与数组，GC 主战场，具体布局由垃圾收集器决定；常见分代模型会区分新生代与老年代，不能把 Eden/Survivor 当成所有收集器固定的物理布局，耗尽抛 OOM）、<strong>方法区</strong>（规范定义的逻辑区域；HotSpot JDK 8+ 的类元数据主要放在本地内存中的 Metaspace。静态字段的值存放在堆中对应的 Class 镜像上，String 常量池中的字符串对象也在堆中）；另有<strong>直接内存</strong>（NIO DirectByteBuffer，堆外）。常用参数：-Xms/-Xmx 控制堆、-Xss 控制栈、-XX:MaxMetaspaceSize 控制元空间。

![HotSpot Java 17 中线程私有的程序计数器和栈、共享堆、元空间以及直接内存之间的分类](/images/java-interview-41/jvm-memory.svg)

*方法区是规范层面的概念；图按 HotSpot Java 17 的常见实现区分类元数据、堆对象与直接内存。*

```bash
# 常见 JVM 内存参数
java -Xms256m -Xmx2g -Xss512k -XX:MaxMetaspaceSize=512m -jar app.jar
# -Xms 初始堆  -Xmx 最大堆  -Xss 线程栈大小
# -XX:MaxMetaspaceSize 元空间上限（类元数据/常量池）
```

- <strong>追问：</strong>字符串常量池在哪个区域？答：JDK 7 之前永久代（方法区），JDK 7 之后移到堆中。

<strong>前后端业务场景：</strong>线上 OOM 排查第一步看日志区分堆 OOM、Metaspace OOM 还是直接内存 OOM，再 dump 堆用 MAT 定位大对象；大 JSON 响应、图片流用 NIO 缓冲要注意直接内存上限。

### 35. 什么是 GC，Java 如何判断一个对象可以被回收

<strong>深度解答：</strong>GC（垃圾回收）自动管理对象内存。判断对象是否存活用<strong>可达性分析</strong>：从 GC Roots（线程栈帧的局部变量引用、静态字段引用、常量引用、JNI 引用等）出发向下遍历，不存在强可达路径的对象进入相应引用处理与回收流程；实际回收时机由 GC 决定。仅靠强引用计数难以处理的<strong>循环引用</strong>，可通过可达性分析识别。finalize 方法不可靠且已废弃，不能作为回收依据。引用类型分强/软/弱/虚引用（软引用可实现受内存压力影响的缓存，但清理时机不可控，业务缓存通常更适合显式容量、过期和淘汰策略；弱引用用于不应阻止对象回收的关联）。回收算法：标记-清除、标记-复制（新生代）、标记-整理（老年代）；Java 17 的服务器配置通常默认使用 G1，低延迟场景也可评估 ZGC；吞吐、延迟与资源成本需要按实际负载测量。

```java
User user = new User("Tom");
user = null;              // 若没有其他强引用链可达，才可能成为 GC 候选对象

// 软引用：可被 GC 按内存压力清理；业务缓存通常还需要显式容量和过期策略
SoftReference<byte[]> cache = new SoftReference<>(new byte[1024]);

// 可达性与引用强度共同决定回收资格；失去强引用不代表立即回收
// GC Roots：线程栈局部变量、静态字段、JNI 引用等
```

- <strong>追问：</strong>哪些对象可以作为 GC Roots？答：活跃线程栈中的局部变量引用、静态字段引用、运行时常量池引用、JNI 引用等。

<strong>前后端业务场景：</strong>内存泄漏三件套：静态集合只增不减、未关闭的流与连接、ThreadLocal 未 remove；排查工具用 jmap/jstat/arthas，先看 GC 频率与堆增长曲线，再 dump 分析对象引用链。

## 并发编程

### 36. Java 中什么是线程，创建线程有哪些常见方式

<strong>深度解答：</strong>线程是进程内的执行单元，Java 程序默认有 main 线程。创建方式：①继承 Thread 重写 run()；②实现 Runnable（配合 lambda 更简洁）；③实现 Callable 配 FutureTask（能拿返回值、抛异常）；④<strong>线程池 ExecutorService</strong>（生产推荐）。关键区分：<strong>start() 启动新线程</strong>由新线程执行 run()；直接调 run() 只是当前线程普通调用方法。线程池核心参数：核心线程数、最大线程数、阻塞队列、空闲存活时间、线程工厂、拒绝策略；对平台线程池，应评估 Executors 各工厂的队列与线程数边界，常用 ThreadPoolExecutor 显式配置。Java 21+ 还可使用虚拟线程执行器处理大量阻塞 I/O；虚拟线程不是用于反复复用的线程池，也不能替代数据库连接数和下游并发限制。

```java
// 方式一：Runnable（配合 lambda）
Runnable task = () -> System.out.println("执行任务");
new Thread(task).start();

// 方式二：Callable 有返回值
FutureTask<Integer> ft = new FutureTask<>(() -> 1 + 1);
new Thread(ft).start();
System.out.println(ft.get());       // 2

// 方式三：线程池（生产推荐，显式配置参数）
ExecutorService pool = new ThreadPoolExecutor(
    4, 16, 60L, TimeUnit.SECONDS,
    new ArrayBlockingQueue<>(1000),
    new ThreadPoolExecutor.CallerRunsPolicy());
pool.execute(task);
pool.shutdown();
```

- <strong>追问：</strong>为什么生产环境不用 Executors 的简单工厂？答：newFixedThreadPool 用无界队列，任务堆积会内存溢出；newCachedThreadPool 最大线程数设为 Integer.MAX_VALUE，实际可能因资源耗尽先失败，可能创建过多线程。

<strong>前后端业务场景：</strong>异步发短信/邮件、批量导入导出用线程池统一管理并发；调用 LLM 等耗时 I/O 可使用受控异步执行或虚拟线程，同时设置超时、取消和下游并发上限；仅把任务提交线程池后立即 Future.get()，仍会阻塞请求线程。需要削峰时还应考虑持久化消息队列、容量边界与拒绝策略。

### 37. 什么是线程安全，synchronized 和 volatile 分别解决什么问题

<strong>深度解答：</strong>线程安全意味着并发调用时仍能满足约定的正确性要求。多个线程无恰当同步地读写共享可变数据，可能出现丢失更新、读到旧值或破坏状态不变量等问题；分析时要区分<strong>原子性、可见性与有序性</strong>。count++ 不是原子操作（读-改-写三步）。<strong>synchronized</strong>：同一把锁提供互斥，并通过“解锁 happens-before 后续对同一锁的加锁”建立可见性；参与维护同一不变量的读写都必须遵守相同锁协议。锁的底层实现随 JDK 变化，不应把旧版本的偏向锁升级路线当作通用规则，JDK 15 已默认禁用并废弃偏向锁。<strong>volatile</strong>：对同一字段的写 happens-before 后续读，用于可见性和相应的有序性约束，并非要求每次物理读写都绕过 CPU 缓存。<strong>volatile 不会让 count++ 这类复合操作变成原子操作</strong>。简单计数可用 AtomicInteger 的原子方法；多个字段的复合不变量通常用同一把锁或重新设计状态结构。CAS 可能重试，并非所有竞争程度下都比锁快。

![两个线程对 volatile 计数器读改写时发生丢失更新，并对比 synchronized 与 AtomicInteger 的适用范围](/images/java-interview-41/concurrency-tools.svg)

*volatile 能建立可见性关系，但不会把读取、加一、写回三步合并成一个原子操作。*

```java
// volatile：可见性 + 有序性约束；不让复合操作自动变原子
volatile boolean running = true;    // 线程开关标志

// synchronized：原子性 + 可见性
class Counter {
    private int count;
    synchronized void add() { count++; }
    synchronized int get() { return count; }
}

// 原子类：incrementAndGet 是原子读改写；竞争下可能重试
AtomicInteger counter = new AtomicInteger();
counter.incrementAndGet();

// 单例双重检查锁：instance 必须 volatile
class Singleton {
    private static volatile Singleton instance;
    private Singleton() {}
    public static Singleton getInstance() {
        if (instance == null) {
            synchronized (Singleton.class) {
                if (instance == null) instance = new Singleton();
            }
        }
        return instance;
    }
}
```

- <strong>追问：</strong>单例双重检查锁为什么要加 volatile？答：防止 instance = new Singleton() 被指令重排，别的线程拿到半初始化对象；volatile 禁止重排保证安全发布。

<strong>前后端业务场景：</strong>库存扣减：内存内的单进程状态可用 synchronized/原子类；数据库库存通常应由带库存条件的原子 UPDATE、事务或乐观锁裁决。JVM 锁跨进程失效，Redis 分布式锁也需要处理租约、故障与数据层约束。volatile 可用于本地标志位，但不能单独保证缓存与数据库双写一致性；这些都是秒杀、库存类系统的高频设计题。

## 框架原理与工程化

### 38. Java 反射是什么，为什么 Spring 等框架大量使用反射

<strong>深度解答：</strong>反射允许程序<strong>在运行期动态获取类信息</strong>（类名、字段、方法、构造器）并创建对象、调用方法，而不必在编译期写死。核心 API：Class.forName、getDeclaredMethod、setAccessible、invoke。Spring 用它实现：扫描组件 → 反射实例化 Bean → 依赖注入 → AOP 动态代理 → 读取注解；MyBatis 用它做结果映射，Jackson 用它做序列化。代价：动态解析与安全检查带来性能开销、破坏封装、模块化下有访问限制；优化手段包括缓存 Method 对象与 MethodHandle。

```java
// 运行期动态获取类信息并调用方法
Class<?> clazz = Class.forName("com.example.User");
Object user = clazz.getDeclaredConstructor(String.class, int.class)
                   .newInstance("Tom", 18);

Method method = clazz.getMethod("sayHello");
method.invoke(user);                 // 动态调用

// Spring 场景：扫描 @Component -> 反射实例化 Bean -> 依赖注入
```

- <strong>追问：</strong>反射为什么慢？答：动态查找、访问检查和调用适配可能带来开销，但“反射一定无法内联”过于绝对，优化效果依赖 JDK 与调用形态；高频路径可缓存元数据，并通过基准测试比较直接调用、反射与 MethodHandle。

<strong>前后端业务场景：</strong>通用组件大量用反射：通用 Excel 导出按注解反射读字段、通用字典转换、框架自动装配；普通业务代码不必为了“炫技”用反射，那是框架层的事。

### 39. Java 注解是什么，注解和反射是如何配合工作的

<strong>深度解答：</strong>注解是附着在类/方法/字段上的<strong>元数据标记</strong>，本身不产生行为。元注解 @Retention 决定生命周期：SOURCE（编译期，如 @Override、Lombok）、CLASS、RUNTIME（<strong>可被反射读取</strong>，框架靠这个）；@Target 限定标注位置。配合流程：注解负责标记 → 反射负责运行时读取 → 框架根据读取结果执行逻辑（如 Spring 扫描 @Component 后实例化、读取 @GetMapping 注册路由）。自定义注解配合 AOP 可集中处理日志、幂等、权限校验等横切逻辑；注解仅是入口，正确性仍依赖代理生效范围、可信身份、请求标识与原子状态存储。

```java
// 自定义注解：RUNTIME 期才能被反射读取
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.METHOD)
public @interface Idempotent {
    String key();
}

// 使用注解做标记
@RestController
public class OrderController {
    @Idempotent(key = "order:create")
    @PostMapping("/orders")
    public Result<?> createOrder(@RequestBody OrderReq req) {
        return Result.ok(orderService.create(req));
    }
}

// 框架侧：反射读取注解，拦截器/AOP 按标记执行幂等逻辑
Method m = clazz.getMethod("createOrder", OrderReq.class);
if (m.isAnnotationPresent(Idempotent.class)) {
    String key = m.getAnnotation(Idempotent.class).key();
    // key 仅表示操作命名空间，不能单独标识一次请求。
    // 还需认证后的用户标识 + 客户端请求 ID，并原子记录处理状态与结果。
}
```

- <strong>追问：</strong>@Override 能被反射读到吗？答：不能，它是 SOURCE 期注解，编译后字节码里已不存在；只有 RUNTIME 期注解反射才可见。

<strong>前后端业务场景：</strong>Spring 的 @RestController / @GetMapping 驱动路由注册、@Transactional 驱动事务、自定义 @IdempotentKey 配合拦截器实现幂等；前端 TypeScript 装饰器（Decorator）与 Java 注解思路同源，都是“标记 + 处理器”模式。

### 40. Maven 是什么，为什么 Java 项目通常需要 Maven

<strong>深度解答：</strong>Maven 是 Java 的<strong>项目管理与构建工具</strong>，解决两件事：<strong>依赖管理</strong>（在 pom.xml 声明坐标，自动从中央仓库/私服下载并带入传递依赖，免去手动下载 jar）和<strong>标准化构建</strong>（生命周期 validate → compile → test → package → verify → install → deploy）。常用命令：mvn clean、compile、test、package、install。工程上还可配私服 Nexus、与 CI/CD 集成；相比 Gradle，Maven 约定优于配置、生态稳定，Gradle 提供灵活 DSL 与增量构建、缓存等机制；实际构建速度应按项目与配置测量。

```xml
<dependencies>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-web</artifactId>
    </dependency>
</dependencies>
```

```bash
mvn clean verify
# clean 清理 -> compile 编译 -> test 测试 -> package 打包 -> verify 验证
```

- <strong>追问：</strong>mvn package 和 mvn install 的区别？答：package 把项目打成 jar/war 到 target 目录；install 额外把产物安装进本地仓库，供同机其他模块依赖引用。

<strong>前后端业务场景：</strong>多模块项目（common / api / service）用 Maven 聚合管理；CI 流水线通常执行 mvn clean verify 运行构建与已配置的测试/校验；明确允许跳过测试时才使用 -DskipTests，这是后端从提交到上线的标准一环。

### 41. Maven 中 pom.xml、依赖传递和依赖冲突分别是什么

<strong>深度解答：</strong>pom.xml 是 Maven 项目核心配置，声明坐标（groupId/artifactId/version）、依赖、插件与构建配置。<strong>依赖传递</strong>：项目依赖 A，A 依赖 B，B 会自动带入，无需直接声明。<strong>依赖冲突</strong>：不同路径引入同一依赖的不同版本（C 1.0 与 C 2.0），Maven 按<strong>依赖调解</strong>规则选版——最短路径优先、同深度先声明者优先；选错版本会出现 NoSuchMethodError、ClassNotFoundException 等典型症状。解决手段：dependencyManagement 统一锁定版本、exclusions 排除传递依赖、optional 标记可选依赖；scope 控制作用域（compile / provided / runtime / test）。排查用 mvn dependency:tree。

```xml
<!-- dependencyManagement：统一版本（版本号仅演示语法，需按兼容性与安全要求选择） -->
<dependencyManagement>
    <dependencies>
        <dependency>
            <groupId>com.google.guava</groupId>
            <artifactId>guava</artifactId>
            <version>33.0.0-jre</version>
        </dependency>
    </dependencies>
</dependencyManagement>

<!-- exclusions：排除不需要的传递依赖 -->
<dependency>
    <groupId>com.example</groupId>
    <artifactId>lib-a</artifactId>
    <version>1.0</version>
    <exclusions>
        <exclusion>
            <groupId>commons-logging</groupId>
            <artifactId>commons-logging</artifactId>
        </exclusion>
    </exclusions>
</dependency>
```

- <strong>追问：</strong>为什么 Spring Boot 项目写依赖不用版本号？答：spring-boot-starter-parent 的 dependencyManagement 通过 BOM 锁定了各 starter 的兼容版本，子项目继承即可。

<strong>前后端业务场景：</strong>升级框架版本后 jar 冲突是高频线上问题；启动报 NoSuchMethodError 时先 dependency:tree 看依赖树，再在 dependencyManagement 里统一版本——这是后端排障的标准动作。

## 参考资料与版本边界

面试回答应先说明所讨论的 JDK 和框架版本，再区分语言规范、虚拟机实现与工程建议。本文核对时参考了以下一手资料：

- [Java 17 语言规范：异常分类](https://docs.oracle.com/javase/specs/jls/se17/html/jls-11.html)与[线程、锁及 happens-before](https://docs.oracle.com/javase/specs/jls/se17/html/jls-17.html)。
- [Java 17 虚拟机规范：运行时数据区](https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html#jvms-2.5)。
- [Oracle JDK 迁移指南：JDK 11 的变化](https://docs.oracle.com/en/java/javase/17/migrate/significant-changes-jdk-release.html)。
- [OpenJDK JEP 280：字符串拼接的 invokedynamic 实现](https://openjdk.org/jeps/280)、[JEP 374：默认禁用并废弃偏向锁](https://openjdk.org/jeps/374)、[JEP 122：移除永久代](https://openjdk.org/jeps/122)。
- [TypeScript 官方 FAQ：泛型在编译时擦除](https://github.com/microsoft/TypeScript/wiki/FAQ#why-cant-i-write-typeof-t-new-t-or-instanceof-t-in-my-generic-function)。
- [Maven：构建生命周期](https://maven.apache.org/guides/introduction/introduction-to-the-lifecycle.html)与[依赖机制](https://maven.apache.org/guides/introduction/introduction-to-dependency-mechanism.html)。
