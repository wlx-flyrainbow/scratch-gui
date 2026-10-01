# 预构建 API 发布

服务器上的四个织梦、相邻 API 使用各自的版本目录。`deploy-origin-server.sh` 和 `deploy-api.sh` 不再在运行中的源码目录执行 Git 重置、安装依赖或编译；发布需要预构建包。数据库迁移必须先在测试库验证、备份并单独执行，发布工具不会自动迁移或回退数据库。

## 在开发机或 CI 构建

相邻：在目标提交的干净工作区执行 `cd origin-server && npm ci --legacy-peer-deps && npm run build`，回到仓库根目录执行：

```sh
python3 deploy/scripts/build-runtime-bundle.py xianglin /tmp/xianglin-api.tar.gz
```

织梦 API 不需要编译；先完成相应 API 检查，再执行：

```sh
python3 deploy/scripts/build-runtime-bundle.py zhimeng /tmp/zhimeng-api.tar.gz
```

包内只有运行代码、包清单和逐文件校验清单，不包含 `.env` 或 Mac 上的依赖目录。清单记录提交及工作区是否有改动；发布前应检查 `source_dirty`。相邻打包前必须重新构建，不能复用其他提交留下的 `dist`。

## 在服务器验证并发布

通过已有 SSH 通道上传包到受保护目录，先检查，再测试环境发布、验证业务，最后生产环境发布。例如：

```sh
sudo python3 /usr/local/sbin/codevalley-release.py xianglin-api-test --bundle /root/xianglin-api.tar.gz --check
sudo PREBUILT_BUNDLE=/root/xianglin-api.tar.gz bash deploy/scripts/deploy-origin-server.sh test
```

织梦使用 `zhimeng-api-test` 以及 `deploy/scripts/deploy-api.sh`。生产对应 `prod`。环境变量与外部数据目录继承该环境正在运行的应用配置；本工具不更新凭据。

工具校验全部文件、依赖锁文件、Node 24、磁盘空间及原应用健康。依赖锁文件必须与服务器已有 Linux 依赖版本一致；若改变依赖，需要先在 Linux 构建并验证独立依赖版本，当前工具会拒绝继续。不要把 Mac 原生依赖复制到 Linux。

发布前通过已有的 PM2 通信接口读取状态，并核对系统服务与守护进程身份。服务未就绪或通信失败时拒绝继续；状态查询不会自动启动另一个 PM2 守护进程。

每次发布建立独立版本目录、保存旧启动配置，并在切换前设置四分钟定时回退。只重新创建目标 PM2 应用，核对实际工作目录、入口、Node 路径、回环监听和健康响应，确认其他应用未变化，然后保存开机恢复状态。单实例切换有短暂不可用窗口。

成功回执写入 `/etc/codevalley-ops/releases/<应用>-<版本>/receipt.json`，包含准确的 `rollback_command`。失败会立即恢复旧应用；控制连接意外中断时由定时任务恢复。旧版本和旧依赖不会自动删除。回退只恢复代码和启动配置，不能撤销数据修改或数据库迁移。

该目录及应用配置包含敏感启动参数，仅 root 可读；恢复资料必须放入加密备份。
